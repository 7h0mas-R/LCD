const lcd = require('../lcdTypes');
const keypress = require('keypress');
const font = require('font');

const font_fixed_8px = new font.Font();
font_fixed_8px.loadFontFromJSON('font_fixed_8px.json')

const bmp1 = [0,62,69,81,69,62,0,62,107,111,107,62,0,28,62,124,62,28];

var viewDirection = 0;
var wrapping = 0;
var contrast = 63;
var allOn = false;

const delayedExecute= function(delay, cb, context, args){
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            cb.apply(context,args);
            resolve();
        }, delay);
    })
}

// make `process.stdin` begin emitting "keypress" events
keypress(process.stdin);


//listen to and process keypress events
process.stdin.on('keypress', function (ch, key) {
// if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'up') up();
// if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'down') down();
// if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'return') select();
// if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'right') select();
// if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'backspace') back();
// if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'left') back();
if (key && !key.ctrl && !key.meta && !key.shift) {
    switch (key.name) {
        case 'a':
            allOn = !allOn;
            myLcd.allPixelsOn = allOn;
            break;
        case 'l':
            myLcd._enqueue(1,[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,128,192,192,224,224,240,120,120,60,60,30,14,15,7,7,15,14,30,60,56,120,240,224,224,192,128,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,128,192,192,224,224,240,248,248,188,156,158,142,15,7,7,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,7,15,14,30,60,56,120,240,224,224,192,128,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,128,192,192,224,240,240,120,56,60,28,222,239,255,255,63,31,15,7,7,3,3,3,3,3,3,7,15,15,30,60,120,240,224,192,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,7,15,14,30,60,56,120,240,224,224,192,128,128,0,0,0,0,0,0,0,0,0,0,0,0,0,240,240,248,184,188,30,30,15,15,7,3,3,1,1,0,0,0,0,28,31,31,7,1,0,0,0,252,252,252,0,0,0,0,0,252,252,252,0,0,0,248,249,251,247,207,159,126,248,248,248,248,0,0,0,0,248,248,248,56,56,120,240,240,224,192,0,0,0,0,192,248,248,248,248,192,0,0,0,0,0,0,0,0,0,0,1,3,3,7,15,14,30,60,56,120,240,224,224,192,128,128,0,1,1,3,7,7,15,30,30,60,56,120,240,240,224,192,192,192,192,192,192,192,192,192,192,192,192,223,255,255,248,240,240,240,254,255,223,193,192,192,192,255,255,192,195,199,207,223,254,255,255,207,255,254,248,240,255,255,255,240,240,248,252,255,223,199,192,240,252,255,223,199,193,193,207,255,255,252,224,192,192,192,224,248,252,252,216,192,192,192,192,192,192,224,224,240,240,120,57,63,31,31,15,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,7,7,15,30,28,60,120,120,240,224,224,192,128,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,7,15,15,30,60,56,120,112,240,224,224,192,192,192,192,192,224,224,240,240,248,254,255,255,247,123,121,60,28,30,14,15,7,7,3,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,3,3,7,15,15,30,60,60,120,240,240,224,192,192,128,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,128,192,192,224,224,240,121,121,61,29,31,15,15,7,7,3,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,3,7,7,15,30,30,60,56,120,240,240,120,120,60,60,30,14,15,7,7,3,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
            break;
        case 'r':
            myLcd.moveToColPage(Math.floor(Math.random()*myLcd._width),Math.floor(Math.random()*myLcd._ramPages))
            break;
        case 't':
            myLcd._enqueue(1,font_fixed_8px.stringToBitmap('Hallo Welt!',0));
            break;
        case 'i':
            myLcd.inverted=!myLcd.inverted;
            break;
        case 'v':
            myLcd.setViewDirection(++viewDirection%4)
            break;
        case 'w':
            myLcd.setWrapping(++wrapping%4)
            break;
        case 'c':
            myLcd.clear();
            break;
        case 'd':
            contrast = Math.max(contrast - 1,0);
            myLcd.setContrast(contrast);
            break;
        case 'u':
            contrast = Math.min(contrast + 1,myLcd._maxContrast);
            myLcd.setContrast(contrast);
            break;
        default:
            break;
    }
}
if (key && key.ctrl && key.name == 'c') {
    process.stdin.pause();
    process.kill(process.pid, "SIGINT");
}
});


let myLcd = new lcd.DogS102({interfaceType: 'TTY'});

process.stdin.setRawMode(true);
process.stdin.resume();

myLcd.setViewDirection(0);
myLcd.clear();
//some characters
myLcd._enqueue(1,[0,96,96,96,96,0,0,20,182,255,182,20,0,4,6,127,6,4,0,16,48,127,48,16,0,8,8,62,28,8,0,8,28,62,8,8,0]);
//back to 0,0
delayedExecute(1000,myLcd.moveToColPage,myLcd,[0,[0,0]])
//next write a full-screen picture
.then(_=>{myLcd.inverted=false;myLcd.setContrast(63)})
.then(_=>delayedExecute(0,myLcd._enqueue,myLcd,[1,[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,128,192,192,224,224,240,120,120,60,60,30,14,15,7,7,15,14,30,60,56,120,240,224,224,192,128,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,128,192,192,224,224,240,248,248,188,156,158,142,15,7,7,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,7,15,14,30,60,56,120,240,224,224,192,128,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,128,192,192,224,240,240,120,56,60,28,222,239,255,255,63,31,15,7,7,3,3,3,3,3,3,7,15,15,30,60,120,240,224,192,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,7,15,14,30,60,56,120,240,224,224,192,128,128,0,0,0,0,0,0,0,0,0,0,0,0,0,240,240,248,184,188,30,30,15,15,7,3,3,1,1,0,0,0,0,28,31,31,7,1,0,0,0,252,252,252,0,0,0,0,0,252,252,252,0,0,0,248,249,251,247,207,159,126,248,248,248,248,0,0,0,0,248,248,248,56,56,120,240,240,224,192,0,0,0,0,192,248,248,248,248,192,0,0,0,0,0,0,0,0,0,0,1,3,3,7,15,14,30,60,56,120,240,224,224,192,128,128,0,1,1,3,7,7,15,30,30,60,56,120,240,240,224,192,192,192,192,192,192,192,192,192,192,192,192,223,255,255,248,240,240,240,254,255,223,193,192,192,192,255,255,192,195,199,207,223,254,255,255,207,255,254,248,240,255,255,255,240,240,248,252,255,223,199,192,240,252,255,223,199,193,193,207,255,255,252,224,192,192,192,224,248,252,252,216,192,192,192,192,192,192,224,224,240,240,120,57,63,31,31,15,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,3,7,7,15,30,28,60,120,120,240,224,224,192,128,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,3,7,15,15,30,60,56,120,112,240,224,224,192,192,192,192,192,224,224,240,240,248,254,255,255,247,123,121,60,28,30,14,15,7,7,3,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,3,3,7,15,15,30,60,60,120,240,240,224,192,192,128,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,128,192,192,224,224,240,121,121,61,29,31,15,15,7,7,3,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,3,7,7,15,30,30,60,56,120,240,240,120,120,60,60,30,14,15,7,7,3,3,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]]))
.then(_=>myLcd.moveToColPage(0,0))
.catch(err => console.log(err))
console.log('')