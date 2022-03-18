'use strict';

const Spi = require('spi-device')
const Gpio = require('onoff').Gpio

const rstPin = new Gpio(20, 'out');
const cdPin = new Gpio(21,'out');

const lcd = new Spi.open(0,0, err =>{
    if (err) {throw err};
    //reset display
    rstPin.write(0,err =>{
        cdPin.write(0, err => {
            var sum = 0;
            for (let i = 0; i < 10000000; i++) {
                sum++
            };
            rstPin.write(1,err => {
                //init display
                cdPin.write(0, err => {
                    var message = [{
                        sendBuffer: Buffer.from([0x40,0xA1,0xC0,0xA4,0xA6,0xA2,0x2F,0x27,0x81,0x10,0xFA,0x90,0xAF]),
                        byteLength: 13,
                        speedHz: 20000
                    }];
                    lcd.transfer (message, err => {
                        if (err) {throw err}
                        var message = [{
                            sendBuffer: Buffer.alloc(816), 
                            byteLength: 102,
                            speedHz: 20000
                        }]; 
                        lcd.transferSync(message, err =>{
                            //send some data
                            cdPin.write(1, err => {
                                var message = [{
                                    sendBuffer: Buffer.from([0x00,0x01,0x01,0x7f,0x01,0x01,0x00,0x00,0x00,0x7f,0x04,0x04,0x78,0x00,0x00,0x00,0x00,0x38,0x44,0x44,0x44,0x38,0x00,0x00,0x00,0x7c,0x04,0x18,0x04,0x78,0x00,0x00,0x00,0x20,0x54,0x54,0x54,0x78,0x00,0x00,0x00,0x08,0x54,0x54,0x54,0x20]),
                                    byteLength:46,
                                    speedHz: 20000
                                }];
                                lcd.transfer(message, err => {
                                    if (err) {throw err}
                                });                            
                            });//data
                        });
                    });                                
                }); //command

            });
        });
    });
});
