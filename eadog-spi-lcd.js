/* Implementation of a node.js driver for DOG LCD-Modules
    by Electronic Assembly.
    Using spi-device: https://www.npmjs.com/package/spi-device
    and onoff: https://www.npmjs.com/package/onoff
    Following the implementation in mcp-spi-adc:
    https://github.com/fivdi/mcp-spi-adc
    
    Some ideas from the C implementation of Jan Michel:
    - dogm-graphic:      https://github.com/mueschel/lcdlib
    The binary encoding of the LCD fonts was also taken from the lcdlib project
    and were converted to a JSON format and combined with a Unicode-lookup table
    The font-handling is done in a separate module called font
*/

'use strict';

const spi = require('spi-device');
const Gpio = require('onoff').Gpio;
const font = require('./font');

//Objects to simulate enumerations

// const alignmentValues = Object.freeze({
// Left: 1,
// Right: 2,
// Center: 3
// });


// const wrapAround = Object.freeze({
// on: 0,
// off: 1
// })

//


/* ----------------------------------------------
Define the properties of the different EA DOG 
display types. Currently, the number of columns
is the only differentiator
---------------------------------------------- */
// const properties128 = Object.freeze({
//   width:              128,
//   height:             64,
//   ramPages:           8,
//   pixelsPerByte:      8,
//   shiftAddrNormal:    0x0,
//   shiftAddrTopview:   0x04,
//   maxSpeedHz: 20000000,
// })

// const properties132 = Object.freeze({
//   width:              132,
//   height:             32,
//   ramPages:           4,
//   pixelsPerByte:      8,
//   shiftAddrNormal:    0x0,
//   shiftAddrTopview:   0x0,
//   maxSpeedHz: 20000000,
// })

// const properties160 = Object.freeze({
//   width:              160,
//   height:             104,
//   ramPages:           26,
//   pixelsPerByte:      4,
//   shiftAddrNormal:    0x0,
//   shiftAddrTopview:   0x0,
//   doublePixel:        1,   
//   maxSpeedHz: 12000000,
// })

// const properties240 = Object.freeze({
//   width:              240,
//   height:             128,
//   ramPages:           16,
//   pixelsPerByte:      8,
//   maxSpeedHz: 8000000,
// })

const viewDirection = Object.freeze({
  top: 1,
  bottom: 0
})

/* 
Define commands to access configuration commands for the display
*/


/** 
 * @typedef initOptions
 * @property {number} [pinCd] GPIO pin of the CD line (MANDATORY)
 * @property {number} [pinRst] - GPIO pin of the RST line (MANDATORY)
 * @property {number} [speedHz] - the communication speed to the display, default: as defined in derived constructor 
 * @property {number} [spiController=0] - the SPI controller, e.g. 1=SPI1, default: 0=SPI0
 * @property {number} [chipSelect=0] - the Chipselect line, e.g. 0=SPIx.0, default:0
 * @property {number} [viewDirection=0] - Display viewed from 1=top or 0=bottom, default: bottom
 * @property {number} [line=0] - start line of the display 0...63
 * @property {boolean} [inverted=false] - display inverted, true or false 
 * @property {number} [biasRatio=0] - ratio 1/9: 0, ratio 1/7: 1
 * @property {number} [volume=10] - contrast setting 0..63
*/

class DogGraphicDisplay {
  /*---------------
  general base class for displays of types DOGL128,DOGM128, DOGM132,DOGS102
  */

  /** Base Constructor for the displays of types DOGL128,DOGM128, DOGM132,DOGS102  
   * @constructor
  */
  constructor() {
    this._width = 0;
    this._height= 0;
    this._ramPages= 0;
    this._pixelsPerByte= 0;
    this._shiftAddrNormal= 0x0;
    this._shiftAddrTopview= 0x1E;
    this._doublePixel= 1; 
    this._maxSpeedHz= 10;
    this._speedHz = 10;
    this._lcdType = "base";
    this._currentColumn = 0;
    this._currentPage = 0;
    this._initMessage = [];
    this._shiftAddr = 0;
    this._inverted = false;
    this._viewDirection = 0; //default bottom
    this._chipSelect = 0;
    this._spiController = 0;
    this._lcd = null;
    this._gpioCd = null;
    this._gpioRst = null;
 }
  
  //getter and setter for the speedHz property
  /** Set the speed of the SPI interface - if you have issues with transmission, reduce
   *  speed to 20000 or lower
   * @param {number} f - frequency in Hertz (Hz)
   */
  set speedHz(f) {
    f = f || this._maxSpeedHz;
    if ((f > this._maxSpeedHz)||(f<1)) {f = this._maxSpeedHz};
    this._speedHz = f;
  };
  /** Get the speed setting of the SPI interface
   */
  get speedHz() {return this._speedHz};

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

  /** Performs a hardware reset of the display by briefly pulling the reset line
   *  low. (Alternatively you can also do a software reset by using swReset command.)
   * @param {number} duration - Duration of the reset pulse in Milliseconds (ms)
   */
  hwReset(duration) {
    return new Promise((resolve, reject) => {
      this._gpioRst.write(0)
      .then(_ => {
        setTimeout(() => {
          this._gpioRst.write(1).then(_ => {resolve()})
        }, duration);
      })
      .catch(()=>{reject(err)})
    });      
  }

  /** Performs a software reset of the display by sending the reset command.
   *  (Alternatively you can also do a hardware reset by using hwReset command.)
   */
  swReset() {
    return this.transfer(0, (this.cmdReset()))
  }


/**
 * Function to initialize the display with a proper Init message
 * @param {initOptions} options - Object with options for initialization
 */
  initialize(options) {
    let self = this;
    return new Promise(function(resolve, reject){
      if (options === undefined) { //options was omitted
          reject(new Error('eadog-spi-lcd.Init: Options cannot be omitted. "pinCd" and "pinRst" are mandatory.'));
          return;
      }
      //define GPIO pin for CD (config/data)
      if (options.pinCd === undefined || options.pinCd === null) {
        reject('eadog-spi-lcd.Init: Options "pinCd" and "pinRst" are mandatory!');
        return;
      }
      self._gpioCd =  new Gpio(options.pinCd,'out'); 
      //define GPIO pin for reset
      if (options.pinRst === undefined || options.pinRst === null) {
        reject('eadog-spi-lcd.Init: Options "pinCd" and "pinRst" are mandatory!');
        return;
      }
      self._gpioRst = new Gpio(options.pinRst, 'out');
      self._speedHz = options.speedHz || self._maxSpeedHz;
      // self._lcd = spi.open(options.spiController || 0, options.chipSelect || 0, {threeWire: true}, err => {  
      //   if (err) {reject(err)};
      //   self.hwReset(10)
      //   .then(_ => {
      //   //Initialize the display
      //   //Build the init message depending on display type
      //     self.initMessage = [
      //       ...self.cmdStartLine(options.line || 0), //0x40
      //       ...self.cmdViewDirection(options.viewDirection || self._viewDirection), //0xA0 0xC8
      //       ...self.cmdAllPixelsOn(false), //0xA4
      //       ...self.cmdInverted(options.inverted || false), //0xA6
      //       ...self.cmdBiasRatio(options.biasRatio || 0), //0xA2
      //       ...self.cmdPowerControl(true, true, true), //0x2F
      //       ...self.cmdBiasVoltageDevider(7), //0x27
      //       ...self.cmdVolume(options.volume || 16), //0x81 0x10
      //     ];
      //     resolve();
      //   });
      // });
    })
  }


  /** Returns the current page (line) number (0..RAMPages) */
  get currentPage() {
    return this._currentPage
  }

  /** Returns the current Column number (0..width-1) */
  get currentColumn() {
    return this._currentColumn
  }

  /** Set the view direction of the display. Bottom view is the normal setting, 
   *  top view is used for displays that are mounted rotated by 180 deg.
   * @param {number} viewDir - 0: bottom view (6 o'clock) 1: top view (12 o'clock)
  */
  set viewDirection(viewDir){
    return this.transfer(0,this.cmdViewDirection(viewDir))
  }

/* --+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+-- 
        Functions that write data to the LCD display
   --+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+-- */

  // /** Draws a bitmap at the current cursor position */
  // drawImageP(image, pages, columns, style) {
  //   let inv = (style & styleValues.inverse);
  //   var tmp = 0x00;
  //   while(j<pages && (this.getPositionPage() < this._properties.ramPages)) {
  //     for (let i=0; i<columns && (this.getPositionColumn() < this._properties.width); i++) {
  //       tmp = image[i][j];
  //       if(!inv) {
  //         this.transfer(messageType.data, tmp)
  //       } else {
  //         this.transfer(messageType.data, ~tmp);
  //       }
  //     }
  //     if(++j != pages && this.getPositionColumn() != 0)
  //       this.moveBy(1,-columns); //carriage return
  //   }
  
  // }

  // /** Draws a bitmap at position x/y. Attention, in this function the row is measured in 
  //    pixels, not pages.
  // */
  // drawImageXYP(image, x, y, pages, columns, style) {

  // }

  /** clears area of columns height and pages width at current cursor position 
   * @param {number} pages - number of pages 1..this._ramPages
   * @param {number} columns - number of colums: 1..this._width
   * @param {number} style - 0:normal, 1: inverse
  */
  clearArea(pages, columns, style){
    pages = Math.min (pages, this._ramPages-this.currentPage);
    columns = Math.min (columns, this.width - this.currentColumn);
    for (let i = 0; i < pages; i++) {
      this.transfer(1, Array(pages*columns).fill((style ==1) ? 0xFF:0x00))
      this.cmdPageAddress(this.currentPage++)
    }
  }

  /** clears area of columns height and pages width at position col/page 
   * @param {number} pages - number of pages 1.. pages of display
   * @param {number} columns - number of colums: 1..this._width
   * @param {number} style - 0:normal, 1: inverse
   * @param {number} page - page of top-left corner of the area to clear
   * @param {number} col - column of top-left corner of the area to clear
  */
  clearAreaXY(pages, columns, style, page, col){
    this.moveToColPage(col, page)
    this.clearArea(pages, columns, style)
  }
  /** Moves the cursor to the given position on the display 
   * @param {number} page - target page 0..this._ramPages
   * @param {number} column - target colum: 0..width - 1
  */
  moveToColPage(column, page){
    return new Promise((resolve, reject) => {
      column = Math.max(0,column);
      column = Math.min (this._width - 1,column);
      page = Math.max(0, page);
      page = Math.min(page, this._ramPages - 1)
      this.transfer(0, ([...this.cmdPageAddress(page),
      ...this.cmdColumnAddress(column)]))
     .then(_ => {
        this._currentPage = page;
        this._currentColumn = column;
        resolve();
     })
     .catch(error => reject(error)); 
    })
  }

  /** Moves the cursor by the given amount of pages/columns 
   * @param {number} pages - vertical offset (pages)
   * @param {number} columns - horizontal offset (columns)
  */
  moveBy(pages, columns){
    return this.moveToColPage((this.currentColumn + columns)%this._width, (this._currentPage + pages)%this._ramPages)
  }

  //Set Contrast
  set Contrast(value){
    value = Math.max(0,value);
    value = Math.min(value, 63);
    return this.transfer(0, (this.cmdVolume(value)))
  }

  clear() {
    return new Promise((resolve, reject) => {
      const message = new Uint8Array(this._width).fill(0);
      const recursion = (ramPages) => {
        return new Promise((res) => {
          this.moveToColPage(0,this._ramPages - ramPages)
          .then(_ => this.transfer(1,message))
          .then(_ =>{})
          .then(_ => {
            if (ramPages > 1) {
              return recursion(--ramPages)
            }
          })
          .then(_ => res())
        })
      }
      recursion(this._ramPages)
      .then(_=> this.moveToColPage(0,0))
      .then(_=>resolve())
      .catch(error => reject(error))      
    });
  }

  /** Send data to the display
   * @param {number} messageType - cmd: 0, data:1
   * @param {Array} msg - Array with byte data values (0..255)
   */
  transfer(messageType, msg) {
    let self = this;
    return new Promise((resolve, reject) => {
      var message = [{
        sendBuffer: Buffer.from(msg), 
        byteLength: msg.length,
        speedHz: self._speedHz
      }];        
      self._gpioCd.write(messageType)
      .then(_ => {
        return new Promise((res, rej) => {
          self._lcd.transfer(message, err => {
            if (err) {rej(err)} else {res()}
          })
        })
      })
      .then(_=> self._gpioCd.write(0))
      .then(_=> resolve())
      .catch(error => reject(error))
    })
  }
 
  /** Write out data to the LCD display
   * @param {string} text - text to output
   * @param {Font} font - Font Object to use
   * @param {number} style - one of the style values  
   */
  async writeText(text, font, style) {
    let map = font.stringToBitmap(text)

    let heightMult = font.pages;
    if (Buffer.isBuffer(map)) {
        let colsPerPage = map.length/heightMult;
        let printableCols = Math.min( colsPerPage,(this._width - this.currentColumn));
        let printablePages = Math.min(heightMult,(this._ramPages-this.currentPage));
        let subMap = new Uint8Array(printableCols);
        for (let k = 0; k < printablePages; k++) {  //row index
          for (let i = 0; i < printableCols; i++) {
            subMap[i]= map[i*heightMult+k];
          }
          await this.transfer(1, subMap);
          if (printablePages > k+1) {
            await this.moveBy(1,0)
          };
        }
    }

  }

  close() {
      this._gpioCd.unexport()
      this._gpioRst.unexport()
  }
}
/** A class for interacting with an Electronic Assembly - DOGS102 Lcd Display*/ 
class DogS102 extends DogGraphicDisplay {
  /** Constructor of the DogS102 Class
   * @constructor
   */
  constructor () {
    super();
    this._width = 102;
    this._height= 64;
    this._ramPages= 8;
    this._pixelsPerByte= 8;
    this._shiftAddrNormal= 0x00;
    this._shiftAddrTopview= 0x1e;
    this._doublePixel= 1; 
    this._maxSpeedHz= 33000000;
    this._lcdType = "EA DOGS102";
    this.speedHz = this._maxSpeedHz; //need to call the setter again, since the derived class can have higher max speed
  }
  /**
   * Initialize the display with the default settings 
   * @param {initOptions} options - options
  */
 initialize(options){
    let self = this;
    return new Promise((resolve, reject) => {
        super.initialize(options)
        .then(_ =>{
          self.initMessage.push(
          ...self.cmdAdvProgCtrl(true, false, false), //0xFA 0x90
          ...self.cmdSleep(false) //0xAF
          );
        })
        .then(_ => self.transfer(0, self.initMessage))
        .then(_ => resolve())
        .catch(error => reject(error))
    })
  }
}

//Define the objects that are exported by the module
module.exports.DogS102 = DogS102;
module.exports.viewDirection = viewDirection;