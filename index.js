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

const font = require('font');
const fontStyles = require('font').fontStyle;



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

  /*---------------
    Properties
  */
    _width = 0;
    _height= 0;
    _ramPages= 0;
    _pixelsPerByte= 0;
    _shiftAddrNormal= 0x0;
    _shiftAddrTopview= 0x1E;
    _doublePixel= 1; 
    _maxSpeedHz= 10;
    _speedHz = 10;
    _lcdType = "base";
    _currentColumn = 0;
    _currentPage = 0;
    _initMessage = [];
    _shiftAddr = 0;
    _inverted = false;
    _viewDirection = 0; //default bottom
    _chipSelect = 0;
    _spiController = 0;
    _lcd = null;
    _gpioCd = null;
    _gpioRst = null;
    _animationInterval = 1000; //interval in ms
    _pageBuffers = [];
  /** Base Constructor for the displays of types DOGL128,DOGM128, DOGM132,DOGS102  
   * @constructor
  */
  constructor() {
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
    if (duration===undefined) duration = 10;
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
 * Contains the configurations, that are identical for all types of displays
 * @param {initOptions} options - Object with options for initialization
 */
  initialize(options) {
    if (process.platform != 'darwin') {
      console.log(' load module onoff')
      var Gpio = require('onoff').Gpio;
      var Spi = require('spi-device');
    }

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
      self._lcd = new Spi.open(options.spiController || 0, options.chipSelect || 0, {threeWire: true}, err => {  
        if (err) {reject("Failed to open SPI interface.")};
        self.hwReset(10)
        .then(_ => {
        //Initialize the display
        //Build the init message depending on display type
          self.initMessage = [
            ...self.cmdStartLine(options.line || 0), //0x40
            ...self.cmdViewDirection(options.viewDirection || self._viewDirection), //0xA0 0xC8
            ...self.cmdAllPixelsOn(false), //0xA4
            ...self.cmdInverted(options.inverted || false), //0xA6
            ...self.cmdBiasRatio(options.biasRatio || 0), //0xA2
            ...self.cmdPowerControl(true, true, true), //0x2F
            ...self.cmdBiasVoltageDevider(7), //0x27
            ...self.cmdVolume(options.volume || 16), //0x81 0x10
          ];
          resolve();
        });
      });
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

  /** clears count columns from current page at current cursor position 
   * @param {number} count - number of colums: 1..this._width
   * @param {number} style - 0:normal, 1: inverse
  */
  clearColumns(count, style){
    return new Promise((resolve, reject)=>{
      count = Math.min (count, this.width - this.currentColumn);
      this.transfer(1, Array(count).fill((style ==1) ? 0xFF:0x00))
      .then(_=> resolve())
      .catch(err => reject(err))
    })
  }

  /** clears current page 
   * @param {number} style - 0:normal, 1: inverse
   * @param {number} page - page to clear: 0..this._ramPages - 1
  */
  clearPage(page, style){
    return new Promise((resolve, reject)=>{
      let count = this._width;
      this.moveToColPage(0,page)
      .then(_=> this.transfer(1, Array(count).fill((style ==1) ? 0xFF:0x00)))
      .then(_=> resolve())
      .catch(err => reject(err))
    })
  }

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
   * @param {number} page - target page 0..this._ramPages -1
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
    return new Promise(async (resolve) => {
      var self = this;
      let promises = [];
      for (let i = 0; i < self._ramPages; i++) {
          await self.clearPage(i,0);
          if (i + 1 == self._ramPages) resolve() 
      } 
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
//          console.log(message);
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
    let map = font.stringToBitmap(text,style)

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

  /** Write out full line to the LCD display, filling up empty space with void
   * @param {string} text - text to output
   * @param {Font} font - Font Object to use
   * @param {number} style - one of the style values  
   */
  async writeLine(text, font, style) {
    let map = font.stringToBitmap(text,style)

    let heightMult = font.pages;
    if (Buffer.isBuffer(map)) {
        let colsPerPage = map.length/heightMult;
        let printableCols = Math.min( colsPerPage,(this._width - this.currentColumn));
        let printablePages = Math.min(heightMult,(this._ramPages-this.currentPage));
        let subMap = new Uint8Array(this._width);
        for (let k = 0; k < printablePages; k++) {  //row index
          for (let i = 0; i < printableCols; i++) {
            subMap[i]= map[i*heightMult+k];
          }
          for (let i = printableCols; i < this._width; i++) {
            subMap[i]= 0x00;
          }
          await this.transfer(1, subMap);
          if (printablePages > k+1) {
            await this.moveBy(1,0)
          };
        }
    }

  }

  /** Write a line to the LCD, that is longer then the width. Let the text swing back and forth.
   * @param {string} text - text to output
   * @param {Font} font - Font Object to use
   * @param {number} style - one of the style values  
   * @param {number} stepInterval - time in ms between movements
   * @param {number} stepSizePix - number of pixels/columns to move with each step  
   */
  swing(text, font, style, page, stepInterval, stepSizePix) {
    const map = font.stringToBitmap(text,style)
    const heightMult = font.pages;
    const mapCols= map.length;
    if (Buffer.isBuffer(map)) {
        let colsPerPage = mapCols/heightMult;
        let extraCols = Math.max( colsPerPage - this._width,0);
        let printablePages = Math.min(heightMult,(this._ramPages-page));
        let subMap = new Uint8Array(this._width);
        stepInterval = stepInterval || 100;
        stepSizePix = stepSizePix || 50;
        page = page || 0;
        let direction = 1;
        let startCol = 0;
        if (extraCols > 0) {
            return setIntervalAsync(async() => {
              // await this.moveToColPage(0,page);
              // await this.transfer(1, new Uint8Array(this._width).fill(0))
              // await this.moveToColPage(0,page + 1);
              // await this.transfer(1, new Uint8Array(this._width).fill(0))
              await this.moveToColPage(0,page)
              for (let k = 0; k < printablePages; k++) {  //row index
                for (let i = 0; i < this._width; i++) {
                  subMap[i]= map[(startCol + i)*heightMult+k];
                };
                await this.transfer(1, subMap);
                if (printablePages > k+1) {
                    await this.moveBy(1,0);
                };
              }          
              startCol = startCol + direction * stepSizePix;
              if (startCol > colsPerPage - this._width) {
                direction = direction * (-1);
                startCol = colsPerPage - this._width;
              } else if (startCol <= 0) {
                direction = direction * (-1);
                startCol = 0;                
              } else {
                startCol = Math.min(startCol + direction * stepSizePix, colsPerPage - this._width)
              }
          }, stepInterval);
        } else {
          this.moveToColPage(1,page)
          .then(_ => this.writeLine(text, font, style))
        }
    }

  }

  /** Write a line to the LCD, that is longer then the width. Divide the text into multiple parts
   * that are displayed one by one from left to ride repeatedly.
   * @param {string} text - text to output
   * @param {Font} font - Font Object to use
   * @param {number} style - one of the style values  
   * @param {number} stepInterval - time in ms between movements
   * @param {number} stepSizePix - number of pixels/columns to move with each step  
   */
  step(text, font, style, page, stepInterval) {
    const map = font.stringToBitmap(text,style);
    const heightMult = font.pages;
    let mapCols= map.length;
    if (Buffer.isBuffer(map)) {
        let colsPerPage = mapCols/heightMult;
        if (colsPerPage > this._width) {
          let steps = Math.ceil(colsPerPage/this._width);
          let colsMissing = steps * this._width - colsPerPage;
          let printablePages = Math.min(heightMult,(this._ramPages-page));
          let subMap = new Uint8Array(this._width);
          stepInterval = stepInterval || 100;
          page = page || 0;
          let startCol = 0;
          return setIntervalAsync(async() => {
            await this.moveToColPage(0,page)
            for (let k = 0; k < printablePages; k++) {  //row index
              for (let i = 0; i < this._width; i++) {
                subMap[i]= map[(startCol + i)*heightMult+k] || 0;
              };
              await this.transfer(1, subMap);
              if (printablePages > k+1) {
                  await this.moveBy(1,0);
              };
            }          
            startCol = startCol + this._width;
            if (startCol >= steps * this._width) {
              startCol = 0;
            }
          }, stepInterval);
        } else {
          this.moveToColPage(1,page)
          .then(_ => this.writeLine(text, font, style))
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

class TTYSimulator extends DogGraphicDisplay {
  /** Constructor of the TTYSimulator Class
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
    this._maxSpeedHz= 0;
    this._lcdType = "TTYSimulator";
    this.speedHz = this._maxSpeedHz; //need to call the setter again, since the derived class can have higher max speed
  }
  /**
   * Initialize the display with the default settings 
   * @param {initOptions} options - options
  */
 initialize(options){
    let self = this;
    return new Promise((resolve, reject) => {
      if (process.stdout.isTTY) {
        this._TTY = process.stdout;
//        this._TTY.setDefaultEncoding('ascii');
        this._width = this._TTY.columns;
        this._height = this._TTY.rows;
        this._currentColumn = 0;
        this._currentPage = 0;
        this._linesPerPage = 4;
        this._ramPages = Math.floor(this._height/this._linesPerPage);
        this._height = this._ramPages * this._pixelsPerByte;
        if (self._TTY.write("\x1b]11;#FFFF99\x07",err => {
                if (err) reject("Error writing text")
            })){
        } else {
            self._TTY.once("drain")
        }
        self.initializePageBuffers();
        resolve();
      } else {
        reject('TTY Simulator only works, if it is called from a TTY compatible terminal');
      }
    })
  }
 /** Moves the cursor to the given position on TTY terminal 
   * @param {number} page - target page 0..this._ramPages (since 4 lines are needed per ram page, this
   *                         needs to overwrite the original and allow an offset to be passed)
   * @param {number} column - target colum: 0..width - 1
  */
  moveToColPage(column, page, offset){
  var self = this;
  offset = offset || 0;
  offset = Math.min(offset,3);
  self._currentColumn=column;
  self._currentPage = page;
  return new Promise(function(resolve){
      if (self._TTY.cursorTo(column,page*self._linesPerPage + offset,()=>{})) {
          resolve()
      } else {
          self._TTY.once("drain", resolve())
      }
  })
  }

  /** Send data to the display
   * @param {number} messageType - cmd: 0, data:1
   * @param {Array} msg - Array with byte data values (0..255)
   */
  transfer(messageType, msg) {
    let self = this;
    return new Promise(async(resolve, reject) => {
      if (messageType == 1) {   //bitmap data
        let msgWidth = msg.length;
        let output = '';
        if (msgWidth > 0) {
            let max = Math.min(msgWidth,this._width);
              for (let i = 0; i < 4; i++) {  //Bit index (pixel)
                  await this.moveToColPage(this._currentColumn, this._currentPage, i)
                  for (let j = 0; j < max; j++) {  //column index
                    switch (msg[j] >> i*2 & 0x03) {
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
                  output.padEnd(this._width,' ')
                  if (self._TTY.write(output,err => {
                          if (err) reject("Error writing text")
                      })){
                  } else {
                      self._TTY.once("drain")
                  }
                  output='';
              }
              resolve()
        }
      } else {                  //command
        resolve()
      }
    })
  }
}

//Define the objects that are exported by the module
module.exports.TTYSimulator = TTYSimulator;
module.exports.DogS102 = DogS102;
module.exports.viewDirection = viewDirection;
module.exports.fontStyle = font.fontStyle;