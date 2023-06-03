document.addEventListener("keypress", (e)=>{
    e = e || window.event;
    if(e.keyCode === 13){
        console.log("enter!")
        window.location.href = links[button] ?? "/";
    }
});