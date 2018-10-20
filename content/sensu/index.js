
var login = function(username, password){
    var element = document.forms[0].getElementsByTagName( 'input' )[0];
    element.value = username;
    var ev = new Event('input', { bubbles: true});
    ev.simulated = true;
    element.defaultValue = username;
    element.dispatchEvent(ev);

    element = document.forms[0].getElementsByTagName( 'input' )[1];
    element.value = password;
    var ev = new Event('input', { bubbles: true});
    ev.simulated = true;
    element.defaultValue = password;
    element.dispatchEvent(ev);

    document.forms[0].getElementsByTagName( 'button' )[0].click();
};


module.exports = {
    author: "Mohammed O. Tillawy",
    version: "0.1",
    valid_urls: ["*"],
    id: "sensu-1.5",
    name: "sensu",
    description: "sensu-1.5",
    actions: [
        {
            name: "login",
            call: login.toString(),
            call_template: 'index( "{{username}}", "{{password}}")',
            parameters: [
                {
                    name: "username",
                    type: "string"
                },
                {
                    name: "password",
                    type: "string"
                }
            ]
        }
    ]
};