local radioChannels   = {}
local listeActive     = {}
local STAFF_GROUPS    = { ["admin"] = true }
local MAX_FREQ        = 999.999
local MAX_NAME_LEN    = 20
local MAX_PER_CHANNEL = 50

ESX = exports['es_extended']:getSharedObject()

local function isStaff(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return false end
    return STAFF_GROUPS[xPlayer.getGroup()] == true
end

local function isValidFreq(freq)
    local f = tonumber(freq)
    return f ~= nil and f >= 0 and f <= MAX_FREQ
end

local function getRPName(source)
    local xPlayer = ESX.GetPlayerFromId(source)
    if xPlayer then
        return xPlayer.get("firstName") .. " " .. xPlayer.get("lastName")
    end
    return GetPlayerName(source) or "Inconnu"
end

local function buildFinalName(source, rawName)
    local name = (rawName and #rawName >= 1) and rawName or getRPName(source)
    name = name:sub(1, MAX_NAME_LEN)
    return "[" .. source .. "] " .. name
end

local function getPlayerChannel(source)
    for freq, members in pairs(radioChannels) do
        for _, m in ipairs(members) do
            if m.source == source then return freq end
        end
    end
    return nil
end

local function removeFromChannel(source)
    local freq = getPlayerChannel(source)
    if not freq then return nil end
    for i, m in ipairs(radioChannels[freq]) do
        if m.source == source then
            table.remove(radioChannels[freq], i)
            break
        end
    end
    if #radioChannels[freq] == 0 then radioChannels[freq] = nil end
    return freq
end

local function buildList(freq, selfSource)
    local list = {}
    if not radioChannels[freq] then return list end
    for _, m in ipairs(radioChannels[freq]) do
        table.insert(list, {
            id      = m.source,
            name    = m.name,
            self    = m.source == selfSource,
            talking = false
        })
    end
    return list
end

local function broadcast(freq)
    if not radioChannels[freq] then return end
    for _, m in ipairs(radioChannels[freq]) do
        TriggerClientEvent("radio:membersUpdate", m.source, buildList(freq, m.source))
    end
end

local function syncBraveList(freq)
    if not radioChannels[freq] then return end
    local members = {}
    for _, m in ipairs(radioChannels[freq]) do
        table.insert(members, { source = m.source, name = m.name })
    end
    for _, m in ipairs(radioChannels[freq]) do
        TriggerClientEvent("radio:braveSync", m.source, freq, members)
    end
end

exports('getPlayerRadioName', function(source)
    local freq = getPlayerChannel(source)
    if not freq then return nil end
    for _, m in ipairs(radioChannels[freq]) do
        if m.source == source then
            return m.name
        end
    end
    return nil
end)

RegisterNetEvent("radio:getInitialData", function()
    local source  = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end
    local freq = getPlayerChannel(source)
    TriggerClientEvent("radio:receiveInitialData", source, {
        inRadio   = freq ~= nil,
        frequency = freq or "",
        members   = freq and buildList(freq, source) or {},
        isStaff   = isStaff(source)
    })
end)

RegisterNetEvent("radio:join", function(rawFreq, rawName)
    local source  = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end
    if not isValidFreq(rawFreq) then return end

    local freq      = tostring(rawFreq)
    local finalName = buildFinalName(source, rawName)
    local rpName    = getRPName(source)

    if not radioChannels[freq] then radioChannels[freq] = {} end
    if #radioChannels[freq] >= MAX_PER_CHANNEL then
        TriggerClientEvent("radio:error", source, "Canal plein")
        return
    end

    local old = removeFromChannel(source)
    if old then
        broadcast(old)
        syncBraveList(old)
    end
    if not radioChannels[freq] then radioChannels[freq] = {} end

    table.insert(radioChannels[freq], { source = source, name = finalName })
    TriggerClientEvent("radio:joined", source, freq, buildList(freq, source), rpName)
    broadcast(freq)
    syncBraveList(freq)
end)

RegisterNetEvent("radio:leave", function()
    local source  = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end
    local freq = removeFromChannel(source)
    TriggerClientEvent("radio:left", source)
    if freq then
        broadcast(freq)
        syncBraveList(freq)
    end
end)

RegisterNetEvent("radio:kick", function(targetId)
    local source = source
    if not isStaff(source) then return end
    targetId = tonumber(targetId)
    if not targetId or targetId == source then return end
    if not ESX.GetPlayerFromId(targetId) then return end

    local senderFreq = getPlayerChannel(source)
    local targetFreq = getPlayerChannel(targetId)
    if not senderFreq or senderFreq ~= targetFreq then return end

    local freq = removeFromChannel(targetId)
    if freq then
        TriggerClientEvent("radio:kicked", targetId)
        broadcast(freq)
        syncBraveList(freq)
    end
end)

RegisterNetEvent("radio:renameMember", function(targetId, newName)
    local source = source
    if not isStaff(source) then return end
    targetId = tonumber(targetId)
    if not targetId or targetId == source then return end
    if not newName or #newName < 1 then return end
    if not ESX.GetPlayerFromId(targetId) then return end

    local senderFreq = getPlayerChannel(source)
    local targetFreq = getPlayerChannel(targetId)
    if not senderFreq or senderFreq ~= targetFreq then return end

    if radioChannels[targetFreq] then
        for _, m in ipairs(radioChannels[targetFreq]) do
            if m.source == targetId then
                m.name = "[" .. targetId .. "] " .. newName:sub(1, MAX_NAME_LEN)
                break
            end
        end
        broadcast(targetFreq)
        syncBraveList(targetFreq)
    end
end)

RegisterNetEvent("radio:renameSelf", function(newName)
    local source  = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local finalName = buildFinalName(source, newName)

    local freq = getPlayerChannel(source)
    if freq and radioChannels[freq] then
        for _, m in ipairs(radioChannels[freq]) do
            if m.source == source then
                m.name = finalName
                break
            end
        end
        broadcast(freq)
        syncBraveList(freq)
    end
end)

RegisterNetEvent("radio:toggleListe", function(active)
    local source  = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end
    if type(active) ~= "boolean" then return end
    listeActive[source] = active
end)

AddEventHandler("playerDropped", function()
    local source = source
    local freq = removeFromChannel(source)
    if freq then
        broadcast(freq)
        syncBraveList(freq)
    end
    listeActive[source] = nil
end)
