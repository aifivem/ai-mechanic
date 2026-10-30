name 'ai-mechanic'
author 'ai-core'
version '0.1.0'
license 'GPL-3.0-only'
description 'Mechanic shops: repair, tuning with live preview, car washes and the repair kit'
repository 'https://github.com/TGIANN/ai-mechanic'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'data/settings.json',
	'data/shops.json',
	'data/washes.json',
}
