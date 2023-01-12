/* 
Define commands to access configuration commands for the display
*/
/** 
 * @typedef initOptions
 * @property {number} [speedHz] - the communication speed to the display, default: as defined in derived constructor 
 * @property {number} [viewDirection=0] - Display viewed from 1=top or 0=bottom, default: bottom
 * @property {number} [line=0] - start line of the display 0...63
 * @property {boolean} [inverted=false] - display inverted, true or false 
 * @property {number} [biasRatio=0] - ratio 1/9: 0, ratio 1/7: 1
 * @property {number} [volume=10] - contrast setting 0..63
*/

class DogS102 {
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
    initMessage = [];

    constructor(options){
        speedHz = this.maxSpeedHz;
        if (options.speedHz !== undefined) this.speedHz = options.speedHz;
            //Build the init message depending on display type
            self._initMessage = [
                ...self.cmdStartLine(options.line || 0), //0x40
                ...self.cmdViewDirection(options.viewDirection || 0), //0xA0 0xC8
                ...self.cmdAllPixelsOn(false), //0xA4
                ...self.cmdInverted(options.inverted || false), //0xA6
                ...self.cmdBiasRatio(options.biasRatio || 0), //0xA2
                ...self.cmdPowerControl(true, true, true), //0x2F
                ...self.cmdBiasVoltageDevider(7), //0x27
                ...self.cmdVolume(options.volume), //0x81 0x10
            ];
    }

    /* --+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+-- 
        Implementation of the low level hardware commands (denoted by prefix cmd) 
        - all functions return an array of uInt8 valuest
        - the functions just return the code and do not send it to the display
        - multiple commands can be combined an array and sent to the display 
            using the transfer function
        --+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--
    */ 
    /** Returns the command for sending the display to sleep or waking up
    *  @param {boolean} bool - 0: on, 1: sleep
    */
    cmdSleep(bool) {return [0xAE | (bool ? 0:1) ]};

    /** Returns the command for setting the startline
    *  @param {number} line - value between 0 and 8*RamPages
    */
    cmdStartLine(line) {return [0x40 | (line & 0x3F)]}; // bit 6 must be 1 and bits 0..5 contain the line

    /** Returns the command for setting the horizontal Orientation
    *  @param {number} hOrientation - 0: normal, 1: mirrored vertically
    */ 
    cmdHOrientation(hOrientation) {
        this._shiftAddr = (hOrientation == 0?this._shiftAddrTopview:this._shiftAddrNormal)
        return [0xA0 | hOrientation] 
    }; //1: reverse (6 o'clock), 0: normal (12 o'clock)
    
    /** Returns the command for setting the vertical Orientation
    *  @param {number} vOrientation - 0: normal, 8: mirrored horizontally
    */ 
    cmdVOrientation(vOrientation) {return [0xC0 | vOrientation]}; //0: normal (6 o'clock), 8: mirrored (12 o'clock)
    
    /** Returns the combined command for setting the viewDirection 
    *  @param {number} viewDirection - 0: bottom (6 o'clock), >0: top (12 o'clock)
    */ 
    cmdViewDirection(viewDirection) {
        if (viewDirection == 0) {
        this._viewDirection = 0;  //bottom
        //this._shiftAddr = this._shiftAddrNormal
        return [...this.cmdHOrientation(1),...this.cmdVOrientation(0)]
        }
        else {
        this._viewDirection = 1; //top
        //this._shiftAddr = this._shiftAddrTopview
        return [...this.cmdHOrientation(0), ...this.cmdVOrientation(8)]
        }
    };

    cmdInverted(bool) {
        this._inverted = bool;
        return [0xA6 | (bool ? 1:0)]
    };
    cmdAllPixelsOn(bool) {return [0xA4 | (bool ? 1:0)]};
    cmdBiasRatio(br) {return [0xA2 | (br)]};
    cmdReset(){return[0xE2]};
    cmdPowerControl(boosterOn, regulatorOn, followerOn) {return [0x28 | (boosterOn ? 1:0) | (regulatorOn ? 2:0) | (followerOn ? 4:0)]};
    cmdBiasVoltageDevider(i) {return [0x20 | (i & 0x07)]};
    cmdVolume(i) {return [0x81, (0x00 | (i & 0x3F))]};
    cmdPageAddress(page) {return [(0xB0 | (page & 0x0F))]};
    cmdColumnAddress(col) {
        return [0x10 | ((col + this._shiftAddr) & 0xF0)>> 4, ((col + this._shiftAddr) & 0x0F)]
    };
    cmdGotoAddress(display, page, col){
        return [
            ...this.cmdPageAddress(page),
            ...this.cmdColumnAddress(display, col)
        ]
    }; 
    cmdAdvProgCtrl(tempCompHigh, columnWrapOn, pageWrapOn){return [0xFA, 0x10 | (tempCompHigh ? 0x80:0) | (columnWrapOn ? 2:0) | (pageWrapOn ? 1:0)]}

}

module.exports.DogS102 = DogS102;