local identifier = "radioYasser"

while GetResourceState("lb-phone") ~= "started" do
    Wait(500)
end
Wait(1000)

local lbExports = exports["lb-phone"]
for k, v in pairs(lbExports) do
    print("Export lb-phone:", k)
end

local function addApp()
    local added, errorMessage = exports["lb-phone"]:AddCustomApp({
        identifier  = identifier,
        name        = "Radio",
        description = "Application radio pour communiquer sur des fréquences.",
        developer   = "LB",
        defaultApp  = true,
        size        = 59812,
        images      = {
            "https://cfx-nui-" .. GetCurrentResourceName() .. "/ui/dist/screenshot-light.png",
            "https://cfx-nui-" .. GetCurrentResourceName() .. "/ui/dist/screenshot-dark.png"
        },
        ui      = GetCurrentResourceName() .. "/ui/dist/index.html",
        icon    = "https://cfx-nui-" .. GetCurrentResourceName() .. "/ui/dist/icon.png",
        fixBlur = true
    })
    if not added then print("Could not add app:", errorMessage) end
end

Wait(5000)
addApp()

AddEventHandler("onResourceStart", function(resource)
    if resource == "lb-phone" then
        Wait(5000)
        addApp()
    end
end)

local currentFreq = nil
local streamerMode = false

local function sendToApp(data)
    exports["lb-phone"]:SendCustomAppMessage(identifier, data)
end

RegisterNUICallback("getRadioData", function(_, cb)
    TriggerServerEvent("radio:getInitialData")
    cb("ok")
end)

RegisterNetEvent("radio:receiveInitialData", function(data)
    sendToApp({
        type      = "radioUpdate",
        inRadio   = data.inRadio,
        frequency = data.frequency or "",
        members   = data.members or {},
        isStaff   = data.isStaff
    })
    if data.inRadio and data.frequency then
        currentFreq = data.frequency
        exports["pma-voice"]:setRadioChannel(tonumber(data.frequency))
    end
end)

RegisterNUICallback("joinRadio", function(data, cb)
    local freq = tonumber(data.frequency)
    local name = type(data.nickname) == "string" and data.nickname:gsub("%s+", " "):match("^%s*(.-)%s*$") or ""
    if not freq or freq < 0 or freq > 999.999 then
        cb({ success = false, error = "Fréquence invalide" })
        return
    end
    TriggerServerEvent("radio:join", data.frequency, name)
    cb({ success = true })
end)

RegisterNUICallback("setMicClicks", function(data, cb)
    local enabled = data.enabled == true
    exports["pma-voice"]:setVoiceProperty("micClicks", enabled)
    cb({ success = true })
end)

RegisterNUICallback("setStreamerMode", function(data, cb)
    streamerMode = data.enabled == true
    TriggerEvent("radioYasser:setStreamerMode", streamerMode)
    cb({ success = true })
end)

RegisterNetEvent("radio:joined", function(freq, members, rpName)
    currentFreq = freq
    TriggerServerEvent("sky:1253419254278752", freq)
    exports["pma-voice"]:setVoiceProperty("radioEnabled", true)
    exports["pma-voice"]:setVoiceProperty("micClicks", true)
    exports["pma-voice"]:setRadioChannel(tonumber(freq))
    TriggerServerEvent("pma-voice:setPlayerRadio", tonumber(freq))

    sendToApp({
        type      = "radioUpdate",
        inRadio   = true,
        frequency = freq,
        members   = members,
        nickname  = rpName or ""
    })
end)

RegisterNUICallback("leaveRadio", function(_, cb)
    TriggerServerEvent("radio:leave")
    exports["pma-voice"]:setVoiceProperty("radioEnabled", false)
    exports["pma-voice"]:setVoiceProperty("micClicks", false)
    exports["pma-voice"]:setRadioChannel(0)
    TriggerServerEvent("pma-voice:setPlayerRadio", 0)
    cb({ success = true })
end)

RegisterNetEvent("radio:left", function()
    if currentFreq then
        exports["pma-voice"]:setRadioChannel(0)
        currentFreq = nil
    end
    sendToApp({ type = "radioUpdate", inRadio = false, frequency = "", members = {} })
end)

RegisterNUICallback("kickFromRadio", function(data, cb)
    local targetId = tonumber(data.id)
    if not targetId then cb({ success = false, error = "Cible invalide" }) return end
    TriggerServerEvent("radio:kick", targetId)
    cb({ success = true })
end)

RegisterNUICallback("renameMember", function(data, cb)
    local targetId = tonumber(data.id)
    local newName  = type(data.name) == "string" and data.name:sub(1, 20) or nil
    if not targetId or not newName or #newName < 1 then
        cb({ success = false, error = "Données invalides" })
        return
    end
    TriggerServerEvent("radio:renameMember", targetId, newName)
    cb({ success = true })
end)

RegisterNUICallback("renameself", function(data, cb)
    local newName = type(data.nickname) == "string" and data.nickname:gsub("%s+", " "):match("^%s*(.-)%s*$") or ""
    TriggerServerEvent("radio:renameSelf", newName)
    cb({ success = true })
end)

RegisterNUICallback("setRadioVolume", function(data, cb)
    local vol = tonumber(data.volume)
    if not vol or vol < 0 or vol > 1 then cb("ok") return end
    exports["pma-voice"]:setRadioVolume(vol)
    exports["pma-voice"]:setCallVolume(vol)
    cb("ok")
end)

RegisterNUICallback("toggleListe", function(data, cb)
    ExecuteCommand('radiolist')
    cb({ success = true })
end)

RegisterNetEvent("radio:membersUpdate", function(members)
    sendToApp({ type = "radioMembersUpdate", members = members })
end)

RegisterNetEvent("radio:kicked", function()
    exports["pma-voice"]:setRadioChannel(0)
    TriggerServerEvent("pma-voice:setPlayerRadio", 0)
    currentFreq = nil
    sendToApp({ type = "radio:kicked" })
end)

RegisterNetEvent("radio:memberTalking", function(memberId, talking)
    sendToApp({ type = "memberTalking", id = memberId, talking = talking })
end)

RegisterNetEvent("radio:braveSync", function(freq, members)
    local PlayerServerID = GetPlayerServerId(PlayerId())
    if streamerMode then
        SendNUIMessage({ clearRadioList = true })
        return
    end
    SendNUIMessage({ clearRadioList = true })
    for _, m in ipairs(members) do
        SendNUIMessage({
            radioId   = m.source,
            radioName = m.name,
            channel   = freq,
            self      = m.source == PlayerServerID
        })
    end
end)

AddEventHandler("onResourceStop", function(resource)
    if resource == GetCurrentResourceName() and currentFreq then
        exports["pma-voice"]:setRadioChannel(0)
    end
end)

AddEventHandler('onEnterJail', function()
    cannotJoin = true
    exports["pma-voice"]:setVoiceProperty("radioEnabled", false)
    exports["pma-voice"]:setVoiceProperty("micClicks", false)
    exports["pma-voice"]:setRadioChannel(0)
    TriggerServerEvent("pma-voice:setPlayerRadio", 0)
end)

AddEventHandler('onLeaveJail', function()
    cannotJoin = false
end)
