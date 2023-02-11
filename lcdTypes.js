/*
This file consists of the basic definitions for supported LCDs. 
Each LCD is represented by a class, which contains the basic binary commands to send to the display as private functions (indicated by _)
and some basic physical properties that are exported using getters (to make them unchangeable).
Since the code has to be in node.js 10 at the moment, the functions are not really encapsulated but use underscore notation. Please do not use the
underscore functions externally unless you really understand, how everything works
.
Each LCD needs to implement some abstract high-level functions for easy use:
- init: initialize the display before first use
- setViewDirection: set the view direction
- moveToColPage: move to specified position on the screen
- moveByColsPages: move by specified amount of columns/pages
- reset: do software reset
- setContrast: set the contrast
- setWrapping: set the wrapping mode
- setStartLine: set the position of the 0 line (shift display content up or down)
- sleep: boolean to set sleep mode on or off
- invert: boolean to set display to inverted
- setAllPixelsOn: boolean to set all pixels to on (to check for defective pixels)
- sendData: send pixel-data to the display
- _enqueue: maintain a message queue and handle all the syncing, so the user does not need to care about race conditions
*/

// const { SpiDevice } = require("spi-device")

/* 
Options for initialization of display settings
*/
 /**
 * @typedef initOptions
 * @property {number} [viewDirection=0] - View direction - 0: default, 1: flip horizontal, 2: flip vertical, 3: rotate 180 deg 
 * @property {number} [line=0] - start line of the display 0...63
 * @property {boolean} [inverted=false] - display inverted, true or false 
 * @property {number} [biasRatio=0] - ratio 1/9: 0, ratio 1/7: 1
 * @property {number} [contrast=10] - contrast setting 0..63
*/

/* 
Options for Interface initialization
*/
/** 
 * @typedef interfaceOptions
 * @property {('TTY'|'SPI')} [interfaceType="TTY"] "TTY" (default - for demonstration) or "SPI"
 * @property {number} [pinCd] GPIO pin of the CD line (MANDATORY)
 * @property {number} [pinRst] - GPIO pin of the RST line (MANDATORY)
 * @property {number} [pinBacklight] - GPIO pin of the Backlight line (OPTIONAL)
 * @property {number} [speedHz=20000] - the communication speed to the display (default: 20kHz)
 * @property {number} [spiController=0] - the SPI controller, e.g. 1=SPI1, default: 0=SPI0
 * @property {number} [chipSelect=0] - the Chipselect line, e.g. 0=SPIx.0, default:0
*/


class DogS102 {
    // some physical parameters of the display
    get _width () {return 102};
    get _height() {return 64};
    get _ramPages() {return 8};
    get _pixelsPerByte() {return 8};
    get _shiftAddrNormal() {return 0x00};
    get _shiftAddrTopview() {return 0x1E};
    get _doublePixel() {return 1}; 
    get _maxSpeedHz() {return 33000000};
    get _minContrast () {return 0};
    get _maxContrast () {return 63};

    //some properties to store some operation data we cannot receive from the display
    /**
    * Command to initialize the display. Options determine initial settings for the display
    * @param {interfaceOptions} options - Object with options for initialization
    */
    constructor(options){
        this._columnWrapOn = false;
        this._pageWrapOn = false;
        this._sleeping = false;
        this._currentColumn = 0;
        this._currentPage = 0;
        this._msgQueue = [];
        this._processing = false;
        switch (options.interfaceType) {
            case "SPI":
                this.biasVoltageDevider = 7;
                this.booster = true;
                this.regulator = true;
                this.follower = true;
                this.interface = "";
                this.temperatureCompensation = true;
                break;
        
            case "TTY":
                this.interface = new TTYSimulator({})
            default:
                break;
        }
    }

    /* --+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+-- 
        Implementation of the low level hardware commands (denoted by prefix _cmd) 
       --+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--*/ 
    _cmdSleep(bool) {return [0xAE | (bool ? 0:1) ]}; //
    _cmdStartLine(line) {return [0x40 | (line & 0x3F)]}; // bit 6 must be 1 and bits 0..5 contain the line
    _cmdHOrientation(hOrientation) {return [0xA0 | hOrientation]}; //1: reverse (6 o'clock), 0: normal (12 o'clock)
    _cmdVOrientation(vOrientation) {return [0xC0 | vOrientation<<3]}; //0: normal (6 o'clock), 8: mirrored (12 o'clock)
    _cmdAllPixelsOn(bool) {return [0xA4 | (bool ? 1:0)]};
    _cmdBiasRatio(br) {return [0xA2 | (br)]};
    _cmdPowerControl(boosterOn, regulatorOn, followerOn) {return [0x28 | (boosterOn ? 1:0) | (regulatorOn ? 2:0) | (followerOn ? 4:0)]};
    _cmdBiasVoltageDevider(i) {return [0x20 | (i & 0x07)]};
    _cmdVolume(i) {return [0x81, (0x00 | (i & 0x3F))]};
    _cmdPageAddress(page) {return [(0xB0 | (page & 0x0F))]};
    _cmdColumnAddress(col) {return [0x10 | ((col + this._shiftAddr) & 0xF0)>> 4, ((col + this._shiftAddr) & 0x0F)]};
    _cmdAdvProgCtrl(tempCompHigh, columnWrapOn, pageWrapOn){return [0xFA, 0x10 | (tempCompHigh ? 0x80:0) | (columnWrapOn ? 2:0) | (pageWrapOn ? 1:0)]}
    _cmdReset(){return [0xE2]};
    _cmdInverted(bool) {return [0xA6 | (bool ? 1:0)]};

    /**
    * Command to initialize the display. Options determine initial settings for the display
    * @param {initOptions} options - Object with options for initialization
    */
    init(options={}){
        //Build the init message depending on display type
        this.startLine = options.line || 0;
        this.viewDirection = options.viewDirection || 0;
        this.allPixelsOn = false;
        this.inverted = options.inverted || false;
        this.biasRatio = options.biasRatio || 0;
        this.contrast = options.contrast;

        return [
            ...this._cmdStartLine(this.startLine), //0x40
            ...this.setViewDirection(this.viewDirection), //0xA0 0xC8
            ...this._cmdAllPixelsOn(this.allPixelsOn), //0xA4
            ...this.inverted(this.inverted), //0xA6
            ...this._cmdBiasRatio(this.biasRatio), //0xA2
            ...this._cmdPowerControl(this.booster,this.regulator, this.follower), //0x2F
            ...this._cmdBiasVoltageDevider(this.biasVoltageDevider), //0x27
            ...this._cmdVolume(this.contrast), //0x81 0x10
            ...this._cmdAdvProgCtrl(this.temperatureCompensation, this.columnWrapOn, this.pageWrapOn), //0xFA 0x90
            ...this._cmdSleep(this.sleeping) //0xAF
        ];
    }

    /**
    /**
    * _enqueue messages for transfer to the display.
        Messages from the queue will be send in FIFO manner.
    * @param {number} messageType - 0: command, 1: data
    * @param {Array} message - Array of Bytes containing command or data to be sent
    */
    _enqueue(msgType, message){
        this._msgQueue.push({msgType, message})          
        this._processMsg();
    }

    /** Callback function for releasing the _processing lock
    */
    _endProcessing(err,msg){
        if (err) {
        } else {
            if (msg) console.log(msg);
            this._processing = false;
            this._processMsg();
        }
    }
    
    /** Send data from the queue to the display
    */
    _processMsg() {
        if (!this._msgQueue.length){
            return;
        } else {
            if (!this._processing) {
                this._processing = true;
                let msg  = this._msgQueue.shift();
                // if (msg.message == undefined) msg.message = [0,0,0,0,0,0,0,0];
                var message = {
                    sendBuffer: Buffer.from(msg.message), 
                    byteLength: msg.message.length,
                    speedHz: this._speedHz
                };        

                // console.log('Set CD: ' + msg.msgType);
                if (this.interface instanceof TTYSimulator) {
                    this.interface.commandMode = !msg.msgType;
                    this.interface.transfer(message, (err, msg) => {this._endProcessing(err,msg)});
                } else if (this.interface instanceof SpiDevice){
                    // this._gpioCd.write(msg.msgType)
                }
                // .then(_ => this._spiTransfer(message))
                // // .then(_=> this._gpioCd.write(0))
                // .catch(error => console.log(error))
                // .finally(_ => {
                this._processMsg()
                // })
            }
        }
    }


    /** Returns the command for setting the viewDirection 
    *  @param {number} viewDirection - 0: default, 1: flip horizontal, 2: flip vertical, 3: rotate 180 deg 
    */ 
    setViewDirection(viewDirection) {
        this.viewDirection = viewDirection;
        this._enqueue(0,[...this._cmdHOrientation(viewDirection & 1),...this._cmdVOrientation((viewDirection & 2)>>1)]);
    };

    /** Command to move the cursor to the given position on the display 
    * @param {number} page - target page 0..ramPages -1
    * @param {number} column - target colum: width - 1
    */
    moveToColPage(column, page){
        column = Math.max(0,column);
        column = Math.min (this._width - 1,column);
        page = Math.max(0, page);
        page = Math.min(page, this._ramPages - 1);
        this._currentColumn = column;
        this._currentPage = page;
        this._enqueue(0, [
            ...this._cmdPageAddress(page),
            ...this._cmdColumnAddress(column)])
    }

    /** Command to sendData to the display
    * @param {Array} message - An array of bytes encoding the bitmap
    */
    sendData(message){
        this._enqueue(1,message);
    }

    /** Command to clean the display
    */
    clear(){
        let lines = this._ramPages;
        for (let i = 0; i < lines; i++) {
            this.moveToColPage(0,i);
            this.sendData(new Array(this._width).fill(255))
        }
        this._processMsg();
    }

    /** Command to set the contrast of the display
    * @param {number} value - Contrast min: 0, max: 63, default: 10
    */
    setContrast(value=10){
        value = Math.max(this.minContrast,value);
        value = Math.min(value, this._maxContrast);
        this.contrast = value;
        return this._cmdVolume(value)
    };

    /** Command to set horizontal and vertical wrapping of the display.
    * @param {number} mode - 0: no wrapping (default), 1: column wrapping, 2: page wrapping, 3: both
    */
    setWrapping(mode=0){
        this.pageWrapOn = mode & 2;
        this.columnWrapOn = mode & 1;
        return this._cmdAdvProgCtrl(true, mode & 1, mode & 2)
    }
    
}

/* 
Options for initialization of display settings
*/
 /**
 * @typedef TTYOptions
 * @property {boolean} [offset = 30] - an invisible offset (like e.g. in the DOGS102) 
 * @property {number} [frequency = 0] - simulates a slow display by delaying the refreshing (similar to SPI-speed), default=-1 meaning no delay
*/

class TTYSimulator {
    // simulates an LCD display by using a TTY terminal

    /**
    * Initialize the display with the default settings 
    * @param {TTYOptions} options - options
    */
    constructor (options={}) {
        if (process.stdout.isTTY) {
            this._TTY = process.stdout;
            this._width = this._TTY.columns;
            this._currentColumn = 0;
            this._currentPage = 0;
            this._linesPerPage = 4;
            this._shiftAddr = 0;
            this._maxContrast = 63;
            this._ramPages = Math.floor(this._TTY.rows / 4);
            this._offset = options.offset || 30;
            this._height = this._ramPages * this._linesPerPage;
            this._cmdBuffer = [];
            this._frequency = options.frequency || 0;
            if (this._TTY.columns < this._width || this._TTY.rows < this._height) {
                console.log('The terminal is too small to display the content.')
            }
    //        this._TTY.setDefaultEncoding('ascii');
            if (this._TTY.write("\x1b]11;#FFFF99\x07",err => {
                    if (err) reject("Error writing text")
                })){
            } else {
                this._TTY.once("drain")
            }
        }
    }

    set commandMode(value) {
        if (value) {
            this._commandMode = true;
        } else {
            this._commandMode = false;
        }
    }

    set sleep (value){
        if (value) {
            this._sleeping = true;
            //clear tty
        } else {
            this._sleeping = false;
        }
    }
    
    set startline (value){
        value = Math.max(0,value);
        value = Math.min(value, this._height)
        this._startLine = value;
    }
    
    set hOrientation (value){
        this._hOrientation = value;
    }
    
    set vOrientation (value){
        this._vOrientation = value;
    }

    set colAddress(value){
        this._currentColumn = value;
        this._TTY.cursorTo(this._currentColumn, this._currentPage*this._linesPerPage)
    }

    set pageAddress(value){
        this._currentPage = value;
        this._TTY.cursorTo(this._currentColumn,this._currentPage*this._linesPerPage)
    }

    set volume(value){
        this.currentPage = value;
        value = Math.max(value, 0);
        value = Math.min(value, this._maxContrast);
        value = (255/this._maxContrast) * value;
        this._TTY.write("\x1b]10;#" + value.toString(16).repeat(3) + "\x07"); //set foreground color in rgb
    }

    /**
    * Transfer Data to the display, depends on setting of commandMode 
    * @param {Buffer} message - the  message data
    */
    transfer(message, cb){
        switch (this._commandMode) {
            case true:
                this._twoByteProcessing = "";
                this._mem = -1;
                for (let i = 0; i < message.byteLength; i++) {
                    switch (this._twoByteProcessing) {
                        case "colAddress":
                            this._twoByteProcessing = "";
                            this._mem = -1;                     
                            this.colAddress = (message.sendBuffer[i] & 0x0F) + (this._mem << 4) - this._shiftAddr;
                            return this._TTY.cursorTo(this._currentColumn,this._currentPage*this._linesPerPage,cb)
                            break;
                        case "volume":
                            this.volume = (message.sendBuffer[i] & 0x3F);  
                            this._twoByteProcessing = "";
                            this._mem = -1;                       
                            break;                    
                        case "advProgCtrl":
                            this.colWrapping = (message.sendBuffer[i] & 2);  
                            this.pageWrapping = (message.sendBuffer[i] & 1);  
                            this._twoByteProcessing = "";
                            this._mem = -1;                       
                            break;                    
                        default:
                            // ATTENTION: When adding masks, make sure to sort in descending order
                            if ((message.sendBuffer[i] & 0xFA) == 0xFA) {this._twoByteProcessing = "advProgCtrl"}
                            else if ((message.sendBuffer[i] & 0xC0) == 0xC0) {this.vOrientation = (message.sendBuffer[i] & 8)>>3}
                            else if ((message.sendBuffer[i] & 0xB0) == 0xB0) {
                                this.pageAddress = message.sendBuffer[i] & 0x0F;
                                return this._TTY.cursorTo(this._currentColumn,this._currentPage*this._linesPerPage,cb)
                            }
                            else if ((message.sendBuffer[i] & 0xAE) == 0xAE) {this.sleep = message.sendBuffer[i] & 1}
                            else if ((message.sendBuffer[i] & 0xA6) == 0xA6) {this.inverted = message.sendBuffer[i] & 1}
                            else if ((message.sendBuffer[i] & 0xA4) == 0xA4) {this.allPixelsOn = message.sendBuffer[i] & 1}
                            else if ((message.sendBuffer[i] & 0xA0) == 0xA0) {this.hOrientation = message.sendBuffer[i] & 1}         
                            else if ((message.sendBuffer[i] & 0x81) == 0x81) {this._twoByteProcessing = "volume"}
                            else if ((message.sendBuffer[i] & 0x40) == 0x40) {this.startline = message.sendBuffer[i] & 0x3F}
                            else if ((message.sendBuffer[i] & 0x10) == 0x10) {this._twoByteProcessing = "colAddress"; this._mem = message.sendBuffer[i] & 0x0F}
                            break;
                    }
                }
                break;
        
            default:
                let msgWidth = message.byteLength;
                let output = '';
                if (msgWidth > 0) {
                    let max = Math.min(msgWidth,this._width);
                    for (let i = 0; i < this._linesPerPage; i++) {  //Bit index (pixel)
                        // this.moveToColPage(this._currentColumn, this._currentPage, i)
                        for (let j = 0; j < max; j++) {  //column index
                            switch ((message.sendBuffer[j] >> i*2) & 0x03) {
                            case 0:
                                output+='\u0020';
                                break;
                            case 1:
                                output+='\u2580';
                                break;
                            case 2:
                                output+='\u2584';
                                break;
                            case 3:
                                output+='\u2588';
                                break;
                            default:
                                break;
                            }
                        }
                        output.padEnd(this._width,' ');
                        this._TTY.write(output,(err)=>{if (err) console.log(err)});
                        output='';
                    }
                }

                break;
        }
        if (this._frequency > 0)
            setTimeout(() => cb(null, null),(Math.floor(message.byteLength/this._frequency*1000)))
        else {
            cb(null,null)
        }
        return this;
    }


//  /** Moves the cursor to the given position on TTY terminal 
//    * @param {number} page - target page 0..this._ramPages (since 4 lines are needed per ram page, this
//    *                         needs to overwrite the original and allow an offset to be passed)
//    * @param {number} column - target colum: 0..width - 1
//   */
//   moveToColPage(column, page, offset){
//   var self = this;
//   offset = offset || 0;
//   offset = Math.min(offset,3);
//   self._currentColumn=column;
//   self._currentPage = page;
//   return new Promise(function(resolve){
//       if (self._TTY.cursorTo(column,page*self._linesPerPage + offset,()=>{})) {
//           resolve()
//       } else {
//           self._TTY.once("drain", resolve())
//       }
//   })
//   }

//   /** Send data to the display
//    * @param {number} messageType - cmd: 0, data:1
//    * @param {Array} msg - Array with byte data values (0..255)
//    */
//   transfer(messageType, msg) {
//     let self = this;
//     return new Promise(async(resolve, reject) => {
//       if (messageType == 1) {   //bitmap data
//         let msgWidth = msg.length;
//         let output = '';
//         if (msgWidth > 0) {
//             let max = Math.min(msgWidth,this._width);
//               for (let i = 0; i < 4; i++) {  //Bit index (pixel)
//                   await this.moveToColPage(this._currentColumn, this._currentPage, i)
//                   for (let j = 0; j < max; j++) {  //column index
//                     switch (msg[j] >> i*2 & 0x03) {
//                       case 0:
//                         output+='\u0020';
//                         break;
//                       case 1:
//                         output+='\u2580';
//                         break;
//                       case 2:
//                         output+='\u2584';
//                         break;
//                       case 3:
//                         output+='\u2588';
//                         break;
//                       default:
//                         break;
//                     }
//                   }
//                   output.padEnd(this._width,' ')
//                   if (self._TTY.write(output,err => {
//                           if (err) reject("Error writing text")
//                       })){
//                   } else {
//                       self._TTY.once("drain")
//                   }
//                   output='';
//               }
//               resolve()
//         }
//       } else {                  //command
//         resolve()
//       }
//     })
//   }
}

module.exports.DogS102 = DogS102;
module.exports.initOptions = this.initOptions;
// module.exports.TTYSimulator = TTYSimulator;