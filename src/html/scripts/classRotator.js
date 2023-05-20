window.onload = function(url) {
    const container = document.querySelector(".container");
    container.classList.add("startup");
    let classNames = ["startup","warlock", "titan", "hunter","default"];
    let i = 0;
    const timeOut = 100;
    const changeClass = () => {
        container.classList.remove(classNames[i]);
        i = i < classNames.length - 1 ? i + 1 : 0;
        container.classList.add(classNames[i]);
    };
    const initialize = () => {
        container.classList.remove("startup");
        container.classList.add(classNames[i+1]);
    }
    window.location=`"${url}"`
    setTimeout(() => {initialize(); classNames = classNames.splice(1, classNames.length);}, timeOut)
    setInterval(changeClass, 3000);
}