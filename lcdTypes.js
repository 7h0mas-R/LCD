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
    get _addrOffset() {return 0x1E};
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
        this._interfaceOpened = false;
        this._sleeping = false;
        this._currentColumn = 0;
        this._currentPage = 0;
        this._msgQueue = [];
        this._processing = false;
        this._offset = 0;
        this._inverted = false;
        this._shiftAddr = 0;
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
                const dogSim = require('./dogSim');
                // this.interface = new dogSim.Simulator;
                this.interface = dogSim.open(options, (error, message) => {
                    if (!error) {
                        this._interfaceOpened = true;
                        this._processMsg();
                    }
                });
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
        this._inverted = options.inverted || false;
        this.biasRatio = options.biasRatio || 0;
        this.contrast = options.contrast;

        this._enqueue(0,[
            ...this._cmdStartLine(this.startLine), //0x40
            ...this.setViewDirection(this.viewDirection), //0xA0 0xC8
            ...this._cmdAllPixelsOn(this.allPixelsOn), //0xA4
            ...this.inverted(this._inverted), //0xA6
            ...this._cmdBiasRatio(this.biasRatio), //0xA2
            ...this._cmdPowerControl(this.booster,this.regulator, this.follower), //0x2F
            ...this._cmdBiasVoltageDevider(this.biasVoltageDevider), //0x27
            ...this._cmdVolume(this.contrast), //0x81 0x10
            ...this._cmdAdvProgCtrl(this.temperatureCompensation, this.columnWrapOn, this.pageWrapOn), //0xFA 0x90
            ...this._cmdSleep(this.sleeping) //0xAF
        ]);
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
        if (!this._msgQueue.length || !this._interfaceOpened){
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
                if (this.interface.constructor.name == 'Simulator' ) {
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
            this.sendData(new Array(this._width).fill(0))
        }
        this.moveToColPage(0,0);
    }

    /** Command to set the contrast of the display
    * @param {number} value - Contrast min: 0, max: 63, default: 10
    */
    setContrast(value=10){
        value = Math.max(this._minContrast,value);
        value = Math.min(value, this._maxContrast);
        this.contrast = value;
        this._enqueue(0, this._cmdVolume(value));
    };

    /** Command to set horizontal and vertical wrapping of the display.
    * @param {number} mode - 0: no wrapping (default), 1: column wrapping, 2: page wrapping, 3: both
    */
    setWrapping(mode=0){
        this.pageWrapOn = (mode & 2)>>1;
        this.columnWrapOn = mode & 1;
        this._enqueue(0,this._cmdAdvProgCtrl(true, this.columnWrapOn, this.pageWrapOn));
    }

    /** Setter to set the display to inverted mode.
    * @type {boolean} value - true: inverted display, false: normal display
    */
    set inverted (value = false){
        this._inverted = value;
        this._enqueue(0,this._cmdInverted(value));
    }
    get inverted (){return this._inverted}

}


module.exports.DogS102 = DogS102;
module.exports.initOptions = this.initOptions;
// module.exports.TTYSimulator = TTYSimulator;