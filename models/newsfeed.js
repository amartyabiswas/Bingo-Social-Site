let mongoose=require('mongoose');
let passportLocalMongoose=require('passport-local-mongoose');

let newsfeedSchema=new mongoose.Schema({
    username: String,
    userid:String,
    img: String,
    video: String,
    description: String,
    msg: String,
    urls: String,
    comments:[{
        username: String,
        content: String
    }]
});

newsfeedSchema.plugin(passportLocalMongoose);
module.exports=mongoose.model("newsfeed", newsfeedSchema);