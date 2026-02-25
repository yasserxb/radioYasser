fx_version "cerulean"
game "gta5"

title "LB Phone - App Template | React JS"
description "A template for creating apps for the LB Phone."
author "Breze & Loaf"

client_script "client.lua"
server_scripts { '@es_extended/imports.lua', 'server.lua' }

file "ui/dist/**/*"
server_exports {
    'getPlayerRadioName'
}

dependencies {
    'es_extended',
    'pma-voice',
    'lb-phone',
    'Brave-RadioList'
}
ui_page "ui/dist/index.html"
-- ui_page "http://localhost:3000"
