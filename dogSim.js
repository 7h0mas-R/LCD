const { OutgoingMessage } = require('http');
const { stdout } = require('process');

const promisify = require('util').promisify;

const write = promisify(stdout.write).bind(stdout);
const clearScreenDown = promisify(stdout.clearScreenDown).bind(stdout);
const cursorTo = promisify(stdout.cursorTo).bind(stdout);

/* 
Options for initialization of display settings
*/
 /**
 * @typedef TTYOptions
 * @property {boolean} [offset = 30] - simulates an "invisible" column-offset (like e.g. in the DOGS102) 
 * @property {number} [frequency = 0] - simulates a slow display by delaying the refreshing (similar to SPI-speed), default=-1 meaning no delay
 * @property {number} [width = 102] - simulated width of the LCD display (pixels). Default: 102
 * @property {number} [ramPages = 8] - simulated height of LCD display (RAM pages). Default: 8
*/


class Simulator {
    // simulates an LCD display by using a TTY terminal

    /**
    * Initialize the display with the default settings 
    * @param {TTYOptions} options - options
    */
    constructor (options={}) {
        this._isOpen = false;
        if (process.stdout.isTTY) {
            this._TTY = process.stdout;
            this._ttyWidth = this._TTY.columns;  //number of columns available in the TTY
            this._ttyHeight = this._TTY.rows;
            this._currentColumn = 0;
            this._currentPage = 0;
            this._linesPerPage = 4;
            this._shiftAddr = options.offset || 0;
            this._maxContrast = 63;
            this._inverted = false;
            this._hOrientation = 0;
            this._vOrientation = 0;
            this._colWrapping = false;
            this._pageWrapping = false;
            this._ramPages = options.ramPages || 8;
            this._width = options.width || 102;
            this._offset = options.offset || 30;
            this._height = this._ramPages * this._linesPerPage;
            this._frequency = options.frequency || 0;
            this._RAM = Array(this._width*this._height).fill(0);
            // if (this._TTY.columns < this._ttyWidth || this._TTY.rows < this._height) {
            //     console.log('The terminal is too small to display the content.')
            // }
    //        this._TTY.setDefaultEncoding('ascii');
            //set the background color of the TTY to some yellowish color
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
            this._TTY.cursorTo(0,0);
            this._TTY.clearScreenDown();
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
        if (this._hOrientation != value) {
            this._currentColumn = this._width - this._currentColumn - 1;
        }
        this._hOrientation = value; //0: normal, 1: mirror
    }
    
    set vOrientation (value){
        if (this._vOrientation != value) {
            this._currentPage = this._ramPages - this._currentPage - 1;
        }
        this._vOrientation = value; //0: normal, 1: mirror
    }

    set colAddress(value){
        this._currentColumn = value;
        if (this._hOrientation) this._currentColumn = this._width - this._currentColumn - 1;
        this._TTY.cursorTo(this._currentColumn, this._currentPage*this._linesPerPage);
    }

    set pageAddress(value){
        this._currentPage = value;
        if (this._vOrientation) this._currentPage = this._ramPages - this._currentPage - 1;
        this._TTY.cursorTo(this._currentColumn,this._currentPage*this._linesPerPage);
    }

    set volume(value){
        //simulates a contrast setting
        value = Math.max(value, 0);
        value = Math.min(value, this._maxContrast);
        value = Math.floor(250/this._maxContrast * (this._maxContrast - value));
        this._TTY.write("\x1b]10;#" + value.toString(16).padStart(2,0).repeat(3) + "\x07"); //set foreground color in rgb
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
                        case "colAddressMSB":
                            this._twoByteProcessing = "";
                            this.colAddress = (message.sendBuffer[i] & 0x0F) + (this._mem) - this._shiftAddr;
                            this._TTY.cursorTo(this._currentColumn,this._currentPage*this._linesPerPage);
                            this._mem = -1;                     
                            break;
                        case "colAddressLSB":
                            this._twoByteProcessing = "";
                            this.colAddress = (message.sendBuffer[i] & 0x0F)<<4 + (this._mem) - this._shiftAddr;
                            this._TTY.cursorTo(this._currentColumn,this._currentPage*this._linesPerPage);
                            this._mem = -1;                     
                            break;
                        case "volume":
                            this.volume = (message.sendBuffer[i] & 0x3F);  
                            this._twoByteProcessing = "";
                            this._mem = -1;                       
                            break;                    
                        case "advProgCtrl":
                            this._colWrapping = ((message.sendBuffer[i] & 2)>>1);  
                            this._pageWrapping = (message.sendBuffer[i] & 1);  
                            this._twoByteProcessing = "";
                            this._mem = -1;                       
                            break;                    
                        default:
                            // ATTENTION: When adding masks, make sure to sort in descending order
                            if ((message.sendBuffer[i] & 0xFA) == 0xFA) {this._twoByteProcessing = "advProgCtrl"} //250
                            else if ((message.sendBuffer[i] & 0xC0) == 0xC0) {this.vOrientation = (message.sendBuffer[i] & 8)>>3} //192..200
                            else if ((message.sendBuffer[i] & 0xB0) == 0xB0) { //176...191
                                this.pageAddress = message.sendBuffer[i] & 0x0F;
                                this._TTY.cursorTo(this._currentColumn,this._currentPage*this._linesPerPage);
                            }
                            else if ((message.sendBuffer[i] & 0xAE) == 0xAE) {this.sleep = message.sendBuffer[i] & 1}  //175...176
                            else if ((message.sendBuffer[i] & 0xA6) == 0xA6) {this._inverted = message.sendBuffer[i] & 1} //166...167
                            else if ((message.sendBuffer[i] & 0xA4) == 0xA4) {this.allPixelsOn = message.sendBuffer[i] & 1} //164...165
                            else if ((message.sendBuffer[i] & 0xA0) == 0xA0) {this.hOrientation = message.sendBuffer[i] & 1} //160...161
                            else if ((message.sendBuffer[i] & 0x81) == 0x81) {this._twoByteProcessing = "volume"} //129
                            else if ((message.sendBuffer[i] & 0x40) == 0x40) {this.startline = message.sendBuffer[i] & 0x3F} //64...127
                            else if ((message.sendBuffer[i] & 0x10) == 0x10) {  //16...31
                                this._twoByteProcessing = "colAddressMSB"; 
                                this._mem = (message.sendBuffer[i] & 0x0F)<<4
                            }
                            else {  //<16
                                this._twoByteProcessing = "colAddressLSB"; 
                                this._mem = (message.sendBuffer[i] & 0x0F)
                            }
                            break;
                    }
                }
                break;
        
            default:
                let msgWidth = message.byteLength;
                let output = '';
                let msg = Array.from(message.sendBuffer);
                if (msgWidth > 0) {
                    do {
                        //calculate available space in active row
                        let space = 0;
                        if (!this._hOrientation) { //horizontal orientation normal
                            space = this._width - this._currentColumn;
                        } else { //horizontal orientation mirrored
                            space = this._currentColumn +1
                        }
                        //splice out data from start or end of msg for the current row
                        let pack = msg.splice(0,space);
                        //calculate start and end position and increment or decrement depending on orientation
                        let hDir = this._hOrientation?-1:1;
                        let vDir = this._vOrientation?-1:1;
                        
                        //loop over the output text and write it to the display
                        for (let i = 0; i < this._linesPerPage; i++) {  //Bit index (pixel)
                            if (this._hOrientation) {
                                this._TTY.cursorTo(this._currentColumn-pack.length + 1,this._currentPage*this._linesPerPage + !this._vOrientation * i + this._vOrientation * Math.abs(i-3));
                            } else {
                                this._TTY.cursorTo(this._currentColumn, (this._currentPage * this._linesPerPage) + !this._vOrientation * i + this._vOrientation * Math.abs(i-3));
                            }
                            let nextChar = '';
                            for (let j = 0; j < pack.length; j++) {  //column index
                                let pattern = (pack[j] >> i*2) & 0x03;
                                if (this._vOrientation) pattern = (((pattern<<2)+pattern)>>1)&0x03;
                                if (this._inverted) pattern = ~(0x04|pattern)&0x03;
                                switch (pattern) {
                                case 0:
                                    nextChar='\u0020';
                                    break;
                                case 1:
                                    nextChar='\u2580';
                                    break;
                                case 2:
                                    nextChar='\u2584';
                                    break;
                                case 3:
                                    nextChar='\u2588';
                                    break;
                                default:
                                    break;
                                }
                                if (this._hOrientation) {   
                                    output = nextChar + output;
                                } else {
                                    output = output + nextChar;
                                }
                            }
                            // output.padEnd(this._ttyWidth,' ');
                            this._TTY.write(output);
                            output='';
                        }
                        //depending on wrapping setting, move cursor to next line and/or column
                        this._currentColumn = (this._currentColumn + hDir * (pack.length - 1));
                        if (space > 0 && (this._currentColumn == 0 || this._currentColumn == this._width - 1)){ //reached edge ==> wrap
                            if (this._pageWrapping) {this._currentPage = (this._currentPage+ vDir + this._ramPages)%this._ramPages}
                            if (this._colWrapping) {
                                this._currentColumn = (this._currentColumn - hDir * (this._width-1))%this._width;
                            } else {
                                if (this._hOrientation) {
                                    this._currentColumn = Math.max(0,this._currentColumn);
                                } else {
                                    this._currentColumn = Math.min(this._width - 1, this._currentColumn)
                                }
                            }
                        }

                    } while (msg.length > 0);
                }
                break;
        }
        if (this._frequency > 0) {
            setTimeout(() => cb(null, null),(Math.floor(message.byteLength/this._frequency*1000)))
            return this
        }
        else {
            cb(null,null)
            return this;
        }
    }

    writeTTY = function(){
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
//             let max = Math.min(msgWidth,this._ttyWidth);
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
//                   output.padEnd(this._ttyWidth,' ')
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


/**
* Factory Function to mimic SPI.open
* @param {TTYOptions} options - options
*/
const open = function(options, cb){
    var sim = new Simulator(options);
    write("\x1b]11;#FFFF99\x07")
    .then(_=>write("\x1b]10;#000000\x07")) //set foreground color in rgb
    .then(_=>cursorTo(0,0))
    .then(_=>clearScreenDown())
    .then(_=>{
        this._isOpen = true;
        cb(null, null)
    })
    .catch(err=>{
        cb(err, null)
    })
    return sim;
}

module.exports.Simulator = Simulator;
module.exports.TTYOptions = this.TTYOptions;
module.exports.open = open;
