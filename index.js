/* Implementation of a node.js driver for LCD-Modules
    by Electronic Assembly (potentially extendable).
    Using spi-device: https://www.npmjs.com/package/spi-device
    and onoff: https://www.npmjs.com/package/onoff
    
    The binary encoding of the LCD fonts was taken from the lcdlib project
    and were converted to a JSON format and combined with a Unicode-lookup table
    The font-handling is done in a separate module called font
*/

'use strict';

const font = require('font');
const fontStyles = require('font').fontStyle;
const lcd = require('./lcdTypes');
  


const orientation = Object.freeze({
  "standard": 0,
  "flipHorizontal": 1,
  "flipVertical": 2, 
  "180deg": 3
})

/* 
Define commands for configuration of SPI interface in constructor
*/
/** 
 * @typedef interfaceOptions
 * @property {number} [pinCd] GPIO pin of the CD line (MANDATORY)
 * @property {number} [pinRst] - GPIO pin of the RST line (MANDATORY)
 * @property {number} [pinBacklight] - GPIO pin of the Backlight (OPTIONAL)
 * @property {number} [spiController=0] - the SPI controller, e.g. 1=SPI1, default: 0=SPI0
 * @property {number} [chipSelect=0] - the Chipselect line, e.g. 0=SPIx.0, default:0
 * @property {number} [speedHz=20000] - the clock frequency of the SPI interface, default: 20kHz
*/ 



class LCD {
    #currentColumn = 0;
    #currentPage = 0;
    #shiftAddr = 0;
    #inverted = false;
    #orientation = 0; //default bottom
    #chipSelect = 0;
    #spiController = 0;
    #interface = null;
    #gpioCd = null;
    #gpioRst = null;
    #gpioBacklight = null;
    #speedHz = 0;
    #animationInterval = 1000; //interval in ms
    #pageBuffers = [];
    #interfaceOpened = false;
    #messageQueue = [];
    #lcd;
    #processing = false;
  /** Constructor  
   * @constructor
  */
  constructor() {
    this.#lcd = new lcd.DogS102
  }

  /**
  * Function to initialize the display with a proper Init message
  * Contains the configurations, that are identical for all types of displays
   * @param {import('./lcdTypes').initOptions} initOptions 
   */
  initialize(initOptions){
    this.enqueue(0,this.#lcd.getInitCommand(initOptions));
  }
  
  /**
  * @param {interfaceOptions} interfaceOptions - Object with options for initialization
  */
  openInterface(interfaceOptions) {
    var Gpio = require('onoff').Gpio;
    var Spi = require('spi-device');

    let self = this;
    return new Promise(function(resolve, reject){
      if (interfaceOptions === undefined) { //options was omitted
          reject(new Error('LCD openInterface: Options cannot be omitted.'));
          return;
      }
      //define GPIO pin for CD (config/data)
      if (interfaceOptions.pinCd === undefined || interfaceOptions.pinCd === null) {
        reject('LCD openInterface: Options "pinCd" is mandatory!');
        return;
      }
      self.#gpioCd =  new Gpio(interfaceOptions.pinCd,'out'); 
      //define GPIO pin for reset
      if (interfaceOptions.pinRst === undefined || interfaceOptions.pinRst === null) {
        reject('LCD openInterface: Options "pinCd" is mandatory!');
        return;
      }
      self.#gpioRst = new Gpio(interfaceOptions.pinRst, 'out');
      //define GPIO pin for Backlight
      if (interfaceOptions.pinBacklight !== undefined && interfaceOptions.pinBacklight !== null) {
        self.#gpioBacklight = new Gpio(interfaceOptions.pinBacklight, 'out');
      }
      if (interfaceOptions.speedHz !== undefined && interfaceOptions.speedHz !== null) {
        self.speedHz = interfaceOptions.speedHz;
      }
      self.#interface = new Spi.open(interfaceOptions.spiController || 0, interfaceOptions.chipSelect || 0, {threeWire: true}, err => {  
        if (err) {reject("LCD openInterface: Failed to open SPI interface.")};
        self.#interfaceOpened = true;
        resolve();
      })
    })
  }

  closeInterface() {
    return new Promise((resolve, reject) => {
      if (this.#gpioCd !== undefined) this.#gpioCd.unexport();
      if (this.#gpioRst !== undefined) this.#gpioRst.unexport();
      if (this.#gpioBacklight !== undefined && this.#gpioBacklight !== null) this.#gpioBacklight.unexport();
      this.#speedHz = 0;
      this.#interface.close(err => {
        this.#interfaceOpened = false;
        if (err) {
          reject("LCD closeInterface: closing Interface failed")
        }
        else { 
          resolve()
        }
      })
    })
  }

  //getter and setter for the speedHz property
  /** Set the speed of the SPI interface - if you have issues with transmission, reduce
   *  speed to 20000 or lower
   * @param {number} f - frequency in Hertz (Hz)
   */
  set speedHz(f) {
    if ((f===undefined || f > this.#lcd.maxSpeedHz)||(f<1)) {f = this.#lcd.maxSpeedHz};
    this.#speedHz = f;
  };
  /** Get the speed setting of the SPI interface
   */
  get speedHz() {return this.#speedHz};

  /** Performs a hardware reset of the display by briefly pulling the reset line
   *  low. (Alternatively you can also do a software reset by using swReset command.)
   *  hwReset is not required by the UC1701 chip, because swReset does the same thing
   * @param {number} duration - Duration of the reset pulse in Milliseconds (ms)
   */
  hwReset(duration) {
    if (duration===undefined) duration = 10;
    return new Promise((resolve, reject) => {
      this.#gpioRst.write(0)
      .then(_ => {
        setTimeout(() => {
          this.#gpioRst.write(1).then(_ => {resolve()})
        }, duration);
      })
      .catch(()=>{reject(err)})
    });      
  }

  /** Pull the hardware reset pin low to put the driver IC into reset
   */
  hwResetOn(){
    return new Promise((resolve, reject) => {
      this.#gpioRst.write(0)
      .then(_ => {resolve()})
      .catch((err)=>{reject(err)})
    });      
  }

  /** Pull the hardware reset pin high to take the driver IC out of reset
   */
  hwResetOff(){
    return new Promise((resolve, reject) => {
      this.#gpioRst.write(0)
      .then(_ => {resolve()})
      .catch((err)=>{reject(err)})
    });      
  }

  /** Returns the current page (line) number (0..RAMPages) */
  get currentPage() {
    return this.#currentPage
  }

  /** Returns the current Column number (0..width-1) */
  get currentColumn() {
    return this.#currentColumn
  }

  /**
   */
  _spiTransfer(message){
    return new Promise((resolve, reject) => {
      if (this.#interfaceOpened) {
        console.log(message)
        this.#interface.transfer(message, err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      } else {
        reject(new Error('_spiTransfer: interface is not open'))
      }
    })
  }

  /** Send data from the queue to the display
  */
  _transfer() {
    if (!this.#messageQueue.length){
      return;
    } else {
      if (!this.#processing) {
        this.#processing = true;
        let msg  = this.#messageQueue.shift();
        var message = [{
          sendBuffer: Buffer.from(msg.message), 
          byteLength: msg.message.length,
          speedHz: this.#speedHz
        }];        

        //##################### wird so nicht gehen. async for
        this.#gpioCd.write(msg.messageType)
        .then(_ => this._spiTransfer(message))
        // .then(_=> this._gpioCd.write(0))
        .catch(error => console.log(error))
        .finally(_ => {
          this.#processing = false;
          this._transfer()
        })
      }
    }
  }

  /**
   /**
   * Enqueue messages for transfer to the display.
     Messages from the queue will be send in FIFO manner.
  * @param {number} messageType - 0: command, 1: data
  * @param {Array} message - Array of Bytes containing command or data to be sent
  */
  enqueue(msgType, message){
      this.#messageQueue.push({msgType, message})          
      this._transfer();
  }
 


/* --+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+-- 
        Functions that write data to the LCD display
   --+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+-- */

  /** Draws a bitmap at the current cursor position */
  drawImageP(image, pages, columns, style) {
    return new Promise(async (resolve, reject) => {
      if (image.length == pages * columns) {
        let currentCol = this.currentCol;
        for (let pg = 0; pg < pages; pg++) {
          await this.transfer(1,image.slice(pg*columns,pg*columns+columns));
          await this.moveBy(1, -columns);
        }
        resolve();
      } else {
        reject('LCD drawImageP: image data does not contain pages * columns bytes')
      }
    })
  }

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
    let count = this.#lcd.width;
    this.enqueue(0,this.#lcd.getMoveCommand(0,page));
    return this.enqueue(1,Array(count).fill((style ==1) ? 0xFF:0x00))
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
    // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ ERROR in sync programming
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
    // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ ERROR in sync programming
    this.moveToColPage(col, page)
    this.clearArea(pages, columns, style)
  }

  /** Moves the cursor to the given position on the screen
   * @param {number} page - vertical position (page) 0..ramPages - 1
   * @param {number} column - horizontal offset (columns) 0..width - 1
  */
  moveToColPage(page, column){
    return this.enqueue(0, this.#lcd.getMoveCommand(page,column))
  }

  /** Moves the cursor by the given amount of pages/columns 
   * @param {number} pages - vertical offset (pages)
   * @param {number} columns - horizontal offset (columns)
  */
  moveBy(pages, columns){
    // return this.moveToColPage((this.currentColumn + columns)%this._width, (this._currentPage + pages)%this._ramPages)
    return this.enqueue(0,this.#lcd.getMoveCommand(this.#currentColumn + columns, this.#currentPage + pages))
  }

  clear() {
    for (let i = 0; i < this.#lcd.ramPages; i++) {
        let p = this.clearPage(i,0);
        if (i==this.#lcd.ramPages -1) {
          return p};
    } 
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
          // await this.transfer(1, subMap);
          this.enqueue(1,subMap)
          if (printablePages > k+1) {
            // await this.moveBy(1,0)
            this.enqueue(0,this.moveBy(1,0))
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

//@@@@@@@@@@@@@@@@@@@@@@@@@@@@ check if async interval really works as expected
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

//@@@@@@@@@@@@@@@@@@@@@@@@@@@@ check if async interval really works as expected
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
}

class MessagePack {
  messages = [];

  add(messageType, message){
    this.messages.push({msgType: messageType,msg: message})
  }
}
class Range {
/*
The Range defines a subdivision of a screen, its content can be separaetely modified. 
Allows to define certain parts of the display to show specific info
*/
}

class Screen {
//Class for keeping a complete virtual screen content in memory. The screen can be accessed anytime and only 
// on command the screen content is sent to the LCD. While it is sending content, the screen
// blocks the LCD for other access.

}

//Define the objects that are exported by the module
// module.exports.TTYSimulator = TTYSimulator;
module.exports.LCD = LCD;
module.exports.orientation = orientation;
module.exports.fontStyle = font.fontStyle;