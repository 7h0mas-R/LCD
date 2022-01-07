/* 
Implements Class Font that allows to load font data from a font-definition file and 
generate text arrays for use with LCD displays
*/

'use strict';

const fs = require("fs")
const path = require("path")

class Font {
    constructor() {
        this._width = 0;
        this._height = 0;
        this._heightBytes = 0;
        this._proportionalFont = false;
        this._bitmap = null;
        this._positionLookup = null;
        this._widthLookup = null;
        this._characters = null;
        this._spacing = 1;
        this._replacementChar = "_"
        this._replacementCharIdx = -1
    }

    initialize(){
        this._heightBytes = this._height/8;
        this._replacementCharIdx = this.getCharIdx(this._replacementChar);
        this._bitmap = Buffer.from(this._bitmap);
    }
    /* 
    Function to read Font Data from JSON file
    */
    loadFontFromJSON(path) {
        if (fs.existsSync(path)) {
            var j = fs.readFileSync(path, {encoding:'utf8'});
            Object.assign(this,JSON.parse(j))  
            this.initialize();      
        } else {
            var pathOnly = path.dirname(path);
            throw new Error('cannot read font: ' + pathOnly + ' found: ' + fs.readdirSync(pathOnly))
        }
    }

    set spacing(pixels){
        if (typeof pixels == Number) {
            pixels = Math.min(pixels, 50);
            pixels = Math.max(pixels, 0);
            this._spacing = this.spacing
        }
    }

    get spacing(){return this._spacing}

    get pages(){return this._heightBytes}
    /* 
    Function to translate a string into an array with a bitmap for the LCD
    Potential options: 
    */
    stringToBitmap(string) {
        let heightMult = this._heightBytes;
        let spacing = this._spacing;
        let maxCols = (this.getStringWidth(string) + (string.length-1) * spacing);

        let stringMap = Buffer.alloc(maxCols*heightMult);
        let bufPos = 0;
        for (let i = 0; i < string.length; i++) {
            var buf = this.getChar(string[i]);
            buf.copy(stringMap,bufPos,0);
            bufPos+= buf.length + spacing*heightMult;
        }
        return stringMap
    }


    /* 
    Function to calculate the width of the bitmap array to hold the string
    to be displayed (number of columns)
    */
    getStringWidth(string) {
        var width = 0
        for (let i = 0; i < string.length; i++) {
            width += this.getCharWidth(string[i]);
        }
        return width
    }

    /* 
    Function to get the index of a character in the font
    */
    getCharIdx(char) {
        var i = this._characters.indexOf(char);
        if ( i < 0) {
            i = this._replacementCharIdx;
        }
        return i;
    }

    /* 
    Function to read the width of a character from the font data 
    (from width-table for proportional fonts, from font header for fixed fonts)
    */
    getCharWidth(char) {
        if (this._proportionalFont) {
            var columns = this._widthLookup[this.getCharIdx(char)];
        }  else {
            var columns = this._width;
        }      
        return columns;
    }    

    /* 
    Function to calculate the position of a character in the font array based on 
    the width of the preceding characters
    */
    getCharPosition(char) {
        if (this._proportionalFont) {
            var pos = this._positionLookup[this.getCharIdx(char)];
        } else {
            var pos = this.getCharIdx(char)*this._width*this._heightBytes;
        }
        return pos
    }

    /* 
    Function that returns a bitmap of a character reading it from the font array
    */
    getChar(char) {
        let heightMult = this._heightBytes;
        var bytes = this.getCharWidth(char)*this._heightBytes;
        var pos = this.getCharPosition(char);
        // let charMap = [...Array(columns)].map(e => Array(heightMult));
        // var charPos = this.getCharPosition(char);
        // for (let j = 0; j < heightMult; j++) {
        //     for (let i = 0; i < columns; i++) {
        //         charMap[i][j] = (this._data.readUInt8(charPos + i * heightMult + j));
        //     };
        // }
        var charMap = this._bitmap.subarray(pos, pos + bytes);
        return charMap;
    }

    /* 
    This is a function for test purposes only. It prints the content of a bitmap
    to the console, using spaces for 0 and rectangles for 1
    */
    consolePlot(map) {
        let output = '';
        let heightMult = this._heightBytes;
        if (Buffer.isBuffer(map)) {
            let max = (map.length > 96) ? 96: map.length;
            for (let k = 0; k < heightMult; k++) {  //row index
                for (let i = 0; i < 8; i++) {  //Bit index (pixel)
                    for (let j = 0; j < max; j++) {  //column index
                        output += (map[j*heightMult+k] & (1 << i))? '🁢':' ';
                    }
                    console.log(output);
                    output = ""
                }
            }
        }
    }


}

//Define the objects that are exported by the module
module.exports.Font = Font;
