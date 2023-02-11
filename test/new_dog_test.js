const lcd = require('../lcdTypes');
const keypress = require('keypress');

// make `process.stdin` begin emitting "keypress" events
keypress(process.stdin);

//listen to and process keypress events
process.stdin.on('keypress', function (ch, key) {
if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'up') up();
if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'down') down();
if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'return') select();
if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'right') select();
if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'backspace') back();
if (key && !key.ctrl && !key.meta && !key.shift && key.name == 'left') back();

if (key && key.ctrl && key.name == 'c') {
    socket.off('pushBrowseSources');
    process.stdin.pause();
    process.kill(process.pid, "SIGINT");
}
});


let myLcd = new lcd.DogS102({interfaceType: 'TTY'});
myLcd.setViewDirection(0);
myLcd.clear();
myLcd._enqueue(1,[0,96,96,96,96,0,0,20,182,255,182,20,0,4,6,127,6,4,0,16,48,127,48,16,0,8,8,62,28,8,0,8,28,62,8,8,0]);

