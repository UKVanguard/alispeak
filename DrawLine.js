const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let img = new Image();
let age = new Image();
let mid = new Image();
ctx.font = "43px SimHei"
ctx.fillStyle="#fdfeff"
ctx.fillStyle="#ffffff"
let v = 0

reset.onclick = function(){
    ctx.fillStyle = "#ffffff";                    //清空画板的
    ctx.fillRect(0,0,canvas.width,canvas.height);
    document.getElementById("tex").value = null        //去掉文字的
    imag()
}

function ima(){     //初始化图片
img.onload = () => {
    ctx.drawImage(img, 0, 0);
};
mid.onload = () => {
    ctx.drawImage(mid, 318, 0);
    };
age.onload = () => {
    ctx.drawImage(age, 326, 0);
    };
    img.src = '我.jpg';
    mid.src = '超.jpg';
    age.src = '盒1.jpg';
}

function  imag() {       //tex.onchange更新画布1
    let l = document.getElementById("tex").value.toString().length*30
    ctx.fillRect(0,0,5000,229)
    ctx.drawImage(img, 0, 0);
    ctx.drawImage(mid,318, 0,l,229)
    ctx.drawImage(age,317+l,0)
    ctx.fillText(document.getElementById("tex").value,250,157)
}

function image(v) {
    let l = document.getElementById("tex").value.toString().length*30
    let ll = l+v
    ctx.fillRect(0,0,5000,229)
    ctx.drawImage(img, 0, 0);
    ctx.drawImage(mid,318, 0,ll,229)
    ctx.drawImage(age,317+ll,0)
    ctx.fillText(document.getElementById("tex").value,250,157)

}

save.onclick = function save() {
    const newCanvas = document.createElement('canvas');
    const Ctx = newCanvas.getContext('2d');
    let l = document.getElementById("tex").value.toString().length*30
    let ll = l+v
    newCanvas.width = 440+ll;
    newCanvas.height =229;
    Ctx.drawImage(canvas, 0, 0, 460+ll, 229,0,0,456+ll,229);

    const url = newCanvas.toDataURL("image/jpg");
    const a = document.createElement("a");
    a.href = url;
    a.download = "ailis";
    a.target = "_blank"
    a.click();
}

long.onclick = function (){
    v = v+12
    image(v)
}

short.onclick = function (){
    v = v-12
    image(v)
}


// let painting = false;
// let startpoint = {x:undefined , y:undefined};


// function  imag() {       //tex.onchange更新画布2
//     let pul = ctx.measureText(document.getElementById("tex").value)
//     let l = pul.width;
//     ctx.fillStyle="#ffffff"
//     ctx.fillRect(0,0,1500,229)
//     ctx.drawImage(img, 0, 0);
//     ctx.drawImage(mid,318, 0,l,229)
//     ctx.drawImage(age,317+l,0)
//     ctx.font = "40px SimHei"
//     ctx.fillStyle="#fdfeff"
//     ctx.fillText(document.getElementById("tex").value,248,150)

//画板描边
// ctx.strokeStyle = "#000000";
// ctx.lineWidth   = 5;
// ctx.strokeRect(10,10, 950,100);

// canvas.onmousedown = (e) => {
//     let x = e.offsetX;
//     let y = e.offsetY;
//     startpoint = {x:x , y:y};
//     painting = true;
// }
//
// canvas.onmousemove = (e) =>{
//     let x = e.offsetX;
//     let y = e.offsetY;
//     let NewPoint = {x: x, y: y};
//     if(painting){
//         drawLine(startpoint.x,startpoint.y,NewPoint.x,NewPoint.y)
//         startpoint = NewPoint;
//     }
// }
//
// canvas.onmouseup = () =>{
//     painting = false;
//
// }
//
// function drawLine(Xstart, Ystart, Xend, Yend)
// {
//     ctx.beginPath();
//     ctx.lineWidth = 3;
//     ctx.moveTo(Xstart,Ystart);
//     ctx.lineTo(Xend,Yend);
//     ctx.stroke();
//     ctx.closePath();
// }
