/*
This file consists of the basic definitions for supported LCDs. 
Each LCD is represented by a class, which contains the basic binary commands to send to the display as private functions and some 
basic physical properties that are exported using getters (to make them unchangeable).
Since the code has to be in node.js 10 at the moment, the functions are not really encapsulated but use underscore notation. Please do not use the
underscore functions externally.
Each LCD needs to implement some abstract high-level functions to make them interchangeable:
- getInitCommand: returns a binary command to init the display, may take some options to configure the LCD
- getViewDirectionCommand: returns binary command to set the view direction
- getMoveCommand: returns binary command to move to specified position on the screen
- getResetCommand: returns binary command to do software reset
- getInvertedCommand: returns binary command to set display to inverted
- getContrastCommand: returns binary command to set the contrast
- getWrappingCommand: returns binary command to set the wrapping mode
*/

/* 
Define commands to access configuration commands for the display
*/
 /**
 * @typedef initOptions
 * @property {number} [viewDirection=0] - View direction - 0: default, 1: flip horizontal, 2: flip vertical, 3: rotate 180 deg 
 * @property {number} [line=0] - start line of the display 0...63
 * @property {boolean} [inverted=false] - display inverted, true or false 
 * @property {number} [biasRatio=0] - ratio 1/9: 0, ratio 1/7: 1
 * @property {number} [volume=10] - contrast setting 0..63
*/

class DogS102 {
    // some physical parameters of the display
    get width () {return 102};
    get height() {return 64};
    get ramPages() {return 8};
    get pixelsPerByte() {return 8};
    get shiftAddrNormal() {return 0x00};
    get shiftAddrTopview() {return 0x1E};
    get doublePixel() {return 1}; 
    get maxSpeedHz() {return 33000000};
    get minContrast () {return 0};
    get maxContrast () {return 63};

    //some properties to store some operation data we cannot receive from the display
    constructor(){
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

    /** Returns the command for setting the viewDirection 
    *  @param {number} viewDirection - 0: default, 1: flip horizontal, 2: flip vertical, 3: rotate 180 deg 
    */ 
    getViewDirectionCommand(viewDirection) {
        return [...this._cmdHOrientation(viewDirection & 1),...this._cmdVOrientation(!((viewDirection & 2)>>1))];
    };

    /**
    * Command to initialize the display. Options determine initial settings for the display
    * @param {initOptions} options - Object with options for initialization
    */
    getInitCommand(options={}){
        //Build the init message depending on display type

        return [
            ...this._cmdStartLine(options.line || 0), //0x40
            ...this.getViewDirectionCommand(options.viewDirection || 0), //0xA0 0xC8
            ...this._cmdAllPixelsOn(false), //0xA4
            ...this.getInvertedCommand(options.inverted || false), //0xA6
            ...this._cmdBiasRatio(options.biasRatio || 0), //0xA2
            ...this._cmdPowerControl(true, true, true), //0x2F
            ...this._cmdBiasVoltageDevider(7), //0x27
            ...this._cmdVolume(options.volume), //0x81 0x10
            ...this._cmdAdvProgCtrl(true, false, false), //0xFA 0x90
            ...this._cmdSleep(false) //0xAF
        ];
    }
    /** Command to move the cursor to the given position on the display 
    * @param {number} page - target page 0..ramPages -1
    * @param {number} column - target colum: width - 1
    */
    getMoveCommand(column, page){
        column = Math.max(0,column);
        column = Math.min (this.width - 1,column);
        page = Math.max(0, page);
        page = Math.min(page, this.ramPages - 1)
        return [
            ...this._cmdPageAddress(page),
            ...this._cmdColumnAddress(column)]
    }
    
    /** Command to trigger a soft-reset
    */
    getResetCommand(){return [0xE2]};

    /** Command to set the display to inverted
    * @param {boolean} bool - true for inverted display, default: false
    */
    getInvertedCommand(bool) {return [0xA6 | (bool ? 1:0)]};

    /** Command to set the contrast of the display
    * @param {number} value - Contrast min: 0, max: 63, default: 10
    */
    getContrastCommand(value=10){
        value = Math.max(this.minContrast,value);
        value = Math.min(value, this.maxContrast);
        return this._cmdVolume(value)
    };

    /** Command to set horizontal and vertical wrapping of the display.
    * @param {number} mode - 0: no wrapping (default), 1: column wrapping, 2: page wrapping, 3: both
    */
    getWrappingCommand(mode=0){
        return this._cmdAdvProgCtrl(true, mode & 1, mode & 2)
    }
    
}

// class TTYSimulator extends DogGraphicDisplay {
//     // some physical parameters of the display
//     get width () {return 102};
//     get height() {return 64};
//     get ramPages() {return 8};
//     get pixelsPerByte() {return 8};
//     get shiftAddrNormal() {return 0x00};
//     get shiftAddrTopview() {return 0x1E};
//     get doublePixel() {return 1}; 
//     get maxSpeedHz() {return 0};
//     get minContrast () {return 0};
//     get maxContrast () {return 0};

//     constructor () {
//     }
    
//     /**
//     * Initialize the display with the default settings 
//     * @param {initOptions} options - options
//     */
//     initialize(options={}){
//         if (process.stdout.isTTY) {
//             this._TTY = process.stdout;
//     //        this._TTY.setDefaultEncoding('ascii');
//             this._width = this._TTY.columns;
//             this._height = this._TTY.rows;
//             this._currentColumn = 0;
//             this._currentPage = 0;
//             this._linesPerPage = 4;
//             this._ramPages = Math.floor(this._height/this._linesPerPage);
//             this._height = this._ramPages * this._pixelsPerByte;
//             if (self._TTY.write("\x1b]11;#FFFF99\x07",err => {
//                     if (err) reject("Error writing text")
//                 })){
//             } else {
//                 self._TTY.once("drain")
//             }
//             self.initializePageBuffers();
//             resolve();
//         } else {
//             reject('TTY Simulator only works, if it is called from a TTY compatible terminal');
//         }
//     // }

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
// }

module.exports.DogS102 = DogS102;
module.exports.initOptions = this.initOptions;
// module.exports.TTYSimulator = TTYSimulator;