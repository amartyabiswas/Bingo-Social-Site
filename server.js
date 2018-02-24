let express=require('express');
let mongoose=require('mongoose');
let bodyParser=require('body-parser');
let passport=require('passport');
let strategy = require('passport-local').Strategy;
let User=require('./models/user');
let feed=require('./models/newsfeed');
let flash=require('connect-flash');
let cookieParser = require('cookie-parser');
let multer = require('multer');
const ejs = require('ejs');
const path = require('path');
let socket=require('socket.io');
let {hash,compare}= require('./hashing.js');
let obj;
let app=express();
app.use(flash());
app.use(cookieParser());

mongoose.connect('mongodb://localhost/Bingo');

let server=app.listen(process.env.PORT|| 3000, function () {
    console.log('Magic happens at port 3000')
});

//======================Image Uploader=======================

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb){
        cb(null,file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage
}).single('myImage');

app.use(express.static('./public'));

app.post('/upload', (req, res) => {
    upload(req, res, (err) => {
        if(err){
            res.render('register.ejs', {
                msg: err,
                message:''
            });
        } else {
            if(req.file === undefined){
                res.render('register.ejs', {
                    msg: 'Error: No File Selected!',
                    message:''
                });
            } else {
                //console.log(req.file);
                res.render('../public/register.ejs', {
                    msg: path.extname(req.file.originalname),
                    message:'',
                    file: `uploads/${req.file.filename}`
                });
            }
        }
    });
});

//===========================================================

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(require('express-session')({
    secret: "Keyboard cat",
    resave: true,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

let middleregister= function(req,res,next)
{
    hash(req.body.password,function(err,hash){
        if(err)
            res.redirect('/register');
        else{
            req.body.password= hash;
            next();
        }
    });
};

let finduser= function(username,callback){
    User.findOne({username:username},callback);
};

passport.use(new strategy(function(username,password, done ) {
    finduser(username,function(err,user){
        if(err)
            console.log(err);
        if(!user)
            return done(err,false);

        compare(password,user.password,function(err,match){
            if(err)
                throw err;
            if(match)
                return done(null,user);
            else
                return done(null,false);
        });
    });
}));

passport.serializeUser(function(user,done){
    done(null,user.username);
});

passport.deserializeUser(function(username,done){
    finduser(username,function(err,user){
        done(err,user);
    });
});

app.get('/',function(req,res){
    console.log('Cookies: ', req.cookies);
    res.render('login.ejs');
});

//Auth ROUTES....
app.get('/register', function (req, res) {
    console.log('Cookies: ', req.cookies);
    res.render('register.ejs', {message: ''})
});

app.get('/login', isLoggedIn, function (req, res) {
    console.log('Cookies: ', req.cookies);
    res.render('login.ejs')
});

app.get('/myInfo', function (req, res) {
   feed.find({}, function (err, data) {
       if(err){
           console.log(err);
       }else{
            res.render('../public/myInfo/index.ejs',{data: data, file: req.user});
       }
   })
});

app.post('/register',middleregister,function(req,res){
    User.findOne({username:req.body.username}, function (err, data) {
        if(data!=null){
            res.render('register', {message: 'Username has Already been taken'})
        }else{
            let newUser=new User(req.body);
            newUser.save(req.body);
            res.redirect('/login');
        }
    });
});

//Main logic area...
app.post('/login',passport.authenticate('local',{failureRedirect:'/login'}),isLoggedIn, function(req,res){
    //console.log(req.body);
    User.findOne({username:req.body.username}, function (err, data) {
      if(err){
          console.log(err)
      }else{
          obj=req.user;
          feed.find({}, function (err, data) {
              if (err) {
                  console.log(err);
              }
              //console.log(data);
              res.render('profile.ejs', {data: data, file: req.user, msg:''})
          });
      }
    });
});

app.get('/profile',isLoggedIn, function (req, res) {
    User.findOne({_id:req.user._id}, function (err, data) {
        if(err){
            console.log(err)
        }else{
            //console.log(obj);
            feed.find({}, function (err, data) {
                if (err) {
                    console.log(err);
                }
                //console.log(data);
                res.render('profile.ejs', {data: data, file: req.user, msg:''})
            });
        }
    });
});

app.post('/description', function (req, res) {
    //console.log(req.user);

    if(req.body.description===''){
        res.redirect('/profile');
    }else{
        let news={
            username: obj.username,
            userid:obj._id,
            img: '',
            video:'',
            msg:'desc',
            description: req.body.description
        };

        let newUser=new feed(news);
        newUser.save(news);

        res.redirect('/profile');
    }
});

app.post('/urlShare', function (req, res) {
    //console.log(req.user);

    if(req.body.urls===''){
        res.redirect('/profile');
    }else{
        let news={
            username: obj.username,
            userid:obj._id,
            img: '',
            video:'',
            msg:'share',
            urls: req.body.urls
        };

        let newUser=new feed(news);
        newUser.save(news);

        res.redirect('/profile');
    }
});

//========================News-Feed Area===========================

const uploads = multer({
    storage: storage
}).single('avatar');

app.post('/uploads', (req, res) => {
    uploads(req, res, (err) => {
        if(err){
            res.render('profile.ejs', {
                message:'',
                msg: err,
                file:obj
            });
        } else {
            if(req.file === undefined && req.body.image === ''){

                res.redirect('/profile');

            } else if (req.body.image === '') {
                //======================Inserting to the database=================================
                let news={
                    username: obj.username,
                    userid:obj._id,
                    msg:'image',
                    img: req.file.filename,
                    video:'',
                    description: ''
                };

                let newUser=new feed(news);
                newUser.save(news);

                res.redirect('/profile');

            }else{

                let news={
                    username: obj.username,
                    userid:obj._id,
                    img: req.body.image,
                    video:'',
                    msg:'url',
                    description: ''
                };

                let newUser=new feed(news);
                newUser.save(news);

                res.redirect('/profile');
            }
        }
    });
});

//===============================Uploading the Video=======================================

const uploader = multer({
    storage: storage
}).single('myVideo');

app.post('/videoUploads', (req, res) => {
    uploader(req, res, (err) => {
        if(err) {
            res.render('profile.ejs', {
                message:'',
                msg: err,
                file: obj
            });
        } else {
            //console.log(req.file);
            if(req.file === undefined){

                res.redirect('/profile');
            } else {

                //======================Inserting to the database=================================

                let news={
                    username: obj.username,
                    userid:obj._id,
                    img: '',
                    video:req.file.filename,
                    msg:'video',
                    description: '',
                };

                let newUser=new feed(news);
                newUser.save(news);

                res.redirect('/profile');
            }
        }
    });
});

//=============================Adding Cooments and Like Button====================================


app.post('/comment/:id', function (req, res) {
    let id=req.params.id;
    feed.update({_id:id}, { $push: { comments:{username:req.user.username, content:req.body.content} }}, function (err, data) {
        if(err){
            console.log(err);
        }
        //console.log(data);
        res.redirect('/profile');
    })
});

//=====================================Socket Connection==========================================


let activeusers={};
let io = socket(server);
io.on('connection',function (socket) {

    //console.log("Connection established");

    socket.on('send_message',function(data){
        io.emit('get',data);
        // socket.emit('get',data);
    });

    socket.on('user',function(data){
        activeusers[socket.id]=data;
        io.emit('activeusers',activeusers);
    });

    socket.on('disconnect', function(){
        delete activeusers[socket.id];
        //console.log('user disconnected');
        io.emit('activeusers',activeusers);
    });

});

//==================================================================================================

//Deleting the post
app.post('/deletePost/:id', function (req, res) {
    let id=req.params.id;
    feed.remove({_id: id}, function (err,data) {
        if(err){
            console.log(err);
        }else{
            res.redirect('/profile');
        }
    });
});

//Deleting the post
app.post('/deletePosts/:id', function (req, res) {
    let id=req.params.id;
    feed.remove({_id: id}, function (err,data) {
        if(err){
            console.log(err);
        }else{
            res.redirect('/profile');
        }
    });
});


//Logout page...
app.get('/logout',isLoggedIn, function (req, res) {
    req.logout();
    res.redirect('/');
});

//Function to check if the user is logged in or not?? It's a middleware...
function isLoggedIn(req, res, next) {
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect('/');
}

