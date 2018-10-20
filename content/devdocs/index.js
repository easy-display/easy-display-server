

https://devdocs.io/

var searchFor  = function(term){
    var element = document.getElementsByClassName("_search-input")[0];
    element.value = term;
    var ev = new Event('input', { bubbles: true});
    ev.simulated = true;
    element.defaultValue = term;
    element.dispatchEvent(ev);
};

var arrowDown = function(){
    var e = new KeyboardEvent("keydown", {
        bubbles : true,
        cancelable : true,
        char : "ArrowDown",
        key : "ArrowDown",
        shiftKey : false,
        keyCode : 40
    });
    document.dispatchEvent(e);
};

var arrowUp = function(){
    var e = new KeyboardEvent("keydown", {
        bubbles : true,
        cancelable : true,
        char : "ArrowUp",
        key : "ArrowUp",
        shiftKey : false,
        keyCode : 38
    });
    document.dispatchEvent(e);
};


var selectCurrent = function(){
    var e = new KeyboardEvent("keydown", {
        bubbles : true,
        cancelable : true,
        char : "Enter",
        key : "Enter",
        shiftKey : false,
        keyCode : 13
    });
    document.dispatchEvent(e);
};


module.exports = {
    author: "Mohammed O. Tillawy",
    version: "0.1",
    valid_urls: [],
    name: "devdocs",
    description: "devdocs.io",
    actions: [
        {
            name: "searchFor",
            call: searchFor.toString(),
            call_template: 'searchFor( "{{term}}" )',
            parameters: [
                {
                    name: "term",
                    type: "string"
                }
            ]
        },
        {
            name: "arrowUp",
            call: arrowUp.toString(),
            call_template: 'arrowUp()',
            parameters: []
        },
        {
            name: "arrowDown",
            call: arrowDown.toString(),
            call_template: 'arrowDown()',
            parameters: []
        },
        {
            name: "selectCurrent",
            call: selectCurrent.toString(),
            call_template: 'selectCurrent()',
            parameters: []
        }
    ]
};

