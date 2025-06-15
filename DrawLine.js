const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let img = new Image();
let age = new Image();
let mid = new Image();
let text = document.getElementById('tex');
let rangeV = document.getElementById('range');
let saveimg = document.getElementById('save');
let resetimg = document.getElementById('reset');
ctx.font = "43px SimHei"
ctx.fillStyle="#fdfeff"
ctx.fillStyle="#ffffff"
let v = 0
let V = 1


resetimg.onclick = function (){
    ctx.fillStyle = "#ffffff";                    //清空画板的
    ctx.fillRect(0,0,canvas.width,canvas.height);
    document.getElementById("tex").value = null        //去掉文字的
    ima();
    v = 0
    rangeV.value = 50
    num.value = 50
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


function draw(V){
    let l = document.getElementById("tex").value.toString().length*30;
    let i = (l+v)*V
    ctx.fillRect(0,0,5000,229)
    ctx.drawImage(img, 0, 0);
    ctx.drawImage(mid,318, 0,i,229)
    ctx.drawImage(age,317+i,0)
    ctx.fillText(document.getElementById("tex").value,250,157)
}

text.addEventListener('change',function (){
    draw(V);
});
text.addEventListener('input',function (){
    draw(V);
});


saveimg.onclick = function save() {
    const newCanvas = document.createElement('canvas');
    const Ctx = newCanvas.getContext('2d');
    let l = document.getElementById("tex").value.toString().length*30
    let ll = l+v
    newCanvas.width = 440+ll;
    newCanvas.height =229;
    Ctx.drawImage(canvas, 0, 0, 460+ll, 229,0,0,456+ll,229);

    const url = newCanvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = document.getElementById("tex").value;
    a.target = "_blank"
    a.click();
}

const long = document.getElementById("long")
const short = document.getElementById("short")

long.onclick = function (){
    v = v+12
    draw(V)
}


short.onclick = function (){
    v = v-12
    draw(V)
}

rangeV.addEventListener('change',function (){
    num.value = this.value
    V = 1+((this.value-50)/100)
    draw(V);
});
rangeV.addEventListener('input',function (){
    num.value = this.value
    V = 1+((this.value-50)/100)
    draw(V);
})

let num = document.getElementById('rangenum')

num.addEventListener("change",function (){
    rangeV.value = this.value
    console.log(this.value)
    V = 1+(this.value-50)/100
    draw(V);
})
num.addEventListener('input',function (){
    rangeV.value = this.value
    console.log(this.value)
    V = 1+(this.value-50)/100
    draw(V);
})


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
