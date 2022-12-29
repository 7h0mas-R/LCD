# LCD
Module for driving an LCD display attached to the SPI interface.
Exports a class defining the interface for the LCD.
Extendable with different LCD models by inheriting from base-class and overwriting functions.

## Properties
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

## Methods
### Constructor
### openInterface(spiOptions)
### closeInterface()
### initialize(options){
### clearColumns(count, style) - tested
Clears `count` columns on the current page from the current cursor position. If count is larger than the amount of columns to the right, the number gets subtracted.
Style determines, if the pixels should be off (set to 0) or on (set to 1)
### clearPage(style) - tested
Clears all columns on the current page.
Style determines, if the pixels should be off (set to 0) or on (set to 1)

### clearArea (pages, columns, style)
### clearAreaXY(pages, columns, style, page, col)
### moveToColPage(column, page) - tested
Moves the cursor to the specified `column` on the specified `page` (i.e. group of 8-pixel lines the LCD)
### moveBy(pages, columns){
### Contrast(value)
Sets the contrast of the display to the argument. Value can be between 0 and 63. The new contrast setting will become valid immediately.

### clear()
### transfer(messageType, msg) - tested
Transfers a Command or a message to the LCD by bit-banging on the SPI interface. Message type defines, whether a command or message data is sent.
Setting this to "0" sends command data, "1" sends bitmap data.
The `msg` must contain an array of byte values.
### async writeText(text, font, style)
### async writeLine(text, font, style)
### swing(text, font, style, page, stepInterval, stepSizePix)
### step(text, font, style, page, stepInterval)
### close()
