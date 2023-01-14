const lcd = require('../lcdTypes.js');

let myLcd = new lcd.DogS102();
console.log('width: ' + myLcd.width);
console.log('initMessage: ' + myLcd.getInitCommand({biasRatio:0,inverted:true,line:0,volume:10,viewDirection:0}));
