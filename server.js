const qr = require('qr-image');
const express = require('express');
const app = express();
const http = require('http').Server(app)
const io = require('socket.io')(http)
const ethUtil = require('ethereumjs-util');

const conTable = {};

app.set('views', './views')
app.set('view engine', 'pug');

const DEFAUTL_PUBLIC_ADDR = '0x653b9a344accbb759462a661a73f90af28b73565'
const messageStore = {}


app.get('/', function (req, res) {
  const { account } = req.query;
  const locals = {}

  const data = `0x${new Date().getTime()}`
  messageStore[account || DEFAUTL_PUBLIC_ADDR] = data
  locals.message = data
  locals.account = `${account || DEFAUTL_PUBLIC_ADDR}`
  locals.result = ''

  res.render('index', locals)
});


app.get('/verify', function (req, res) {
  const { signature, from, socketId } = req.query;
  let Verified = 'fail'
  console.log('有拿到嗎？' + socketId)
   
  if (signature
    && from
    && messageStore[from]
    && from === conTable[socketId]
  ) {
    // 簽名：signature
    // public addr：from
    // socketId : socketId
    // qrcode message：messageStore[from]
    
    // const data = messageStore[from];
    const data = messageStore[conTable[socketId]]; //拿 server 當時產稱的 message
    const signatureBuffered = ethUtil.toBuffer(signature)
    const message = ethUtil.toBuffer(data)
    const msgHash = ethUtil.hashPersonalMessage(message)
    const sigParams = ethUtil.fromRpcSig(signatureBuffered)
    const publicKey = ethUtil.ecrecover(
      msgHash,
      sigParams.v,
      sigParams.r,
      sigParams.s
    )
    const sender = ethUtil.publicToAddress(publicKey)
    const addr = ethUtil.bufferToHex(sender)
    // if (addr !== messageStore[from]) {
    // server 所記錄 socketId 對應的 public addr比較
    if (addr !== conTable[socketId]) {
      console.log('驗證失敗')
      Verified = 'fail'
      res
        .status(401)
        .send('Failed to verify')
        .end();
    } else {
      console.log('驗證成功。')
      Verified = 'success'
      res
        .status(200)
        .send('Verified')
    }
  } else {
    console.log('驗證失敗')
    Verified = 'fail'
    res
      .status(401)
      .send('Failed to verify');
  }
  
  if (conTable[socketId]) {
    io.sockets.connected[socketId].emit(
      'verify',
      Verified,
    );
  }
  res.end();
});

app.get('/qrcode', function(req, res) {
  const { data, socketId } = JSON.parse(req.query.qrurl);
  const code = qr.image(
    JSON.stringify({
      data,
      socketId,
      type: 'TwoFactorAuthentication'
    }),
    { type: 'png' }
  );
  res.type('png');
  code.pipe(res);
});

io.on('connection', function (socket) {
  console.log("一位使用者已連接. Socket id = ", socket.id);

  socket.on('join', function (userAccount) {
    conTable[socket.id] = userAccount;

    io.sockets.connected[socket.id].emit(
      'getSocketId',
      socket.id,
    );
  });

  socket.on('leave', function (rooms) {
    console.log('Socket %s unSubScribed from %s', socket.id, rooms);

    if (conTable[socket.id] !== undefined) {
      delete conTable[socket.id];
    }

  });

  socket.on('disconnect', function () {
    console.log('一位使用者離開了 %s Socket id %s', socket.id);
    if (conTable[socket.id] !== undefined) {
      delete conTable[socket.id];
    }
  });
});

app.get('/verifyHost', function (req, res) {
  res.sendStatus(200);
})
const port = process.env.PORT || 8088

http.listen(port, function () {
  console.log('listening on *:' + port);
});
