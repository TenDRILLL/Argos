$ = function(id) {
    return document.getElementById(id);
}  
var show = function(id) {
    console.log("show")
    $(id).style.display ='block';
}
var hide = function(id) {
    console.log("hide")
    $(id).style.display ='none';
}