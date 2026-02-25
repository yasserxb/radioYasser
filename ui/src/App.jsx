import { useEffect, useRef, useState, useCallback } from 'react';
import Frame from './components/Frame';
import './App.css';
const devMode = !window.invokeNative;

const App = () => {
    const [theme, setTheme] = useState('dark');
    const [frequency, setFrequency] = useState('');
    const [inputFreq, setInputFreq] = useState('');
    const [nickname, setNickname] = useState('');
    const [inputNick, setInputNick] = useState('');
    const [inRadio, setInRadio] = useState(false);
    const [members, setMembers] = useState([]);
    const [isStaff, setIsStaff] = useState(false);
    const [activeTab, setActiveTab] = useState('radio');
    const [notification, setNotif] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameVal] = useState('');
    const [volume, setVolume] = useState(100);
    const [listeActive, setListeActive] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [streamerMode, setStreamerMode] = useState(false);
    const appDiv = useRef(null);
    const notifTimer = useRef(null);

    const { fetchNui, getSettings, onSettingsChange } = window;

    const showNotif = useCallback((msg, type = 'info') => {
        if (notifTimer.current) clearTimeout(notifTimer.current);
        setNotif({ msg, type });
        notifTimer.current = setTimeout(() => setNotif(null), 2500);
    }, []);

    useEffect(() => {
        if (devMode) {
            document.getElementsByTagName('html')[0].style.visibility = 'visible';
            document.getElementsByTagName('body')[0].style.visibility = 'visible';
            setIsStaff(true);
            return;
        }

        getSettings().then((s) => setTheme(s.display.theme));
        onSettingsChange((s) => setTheme(s.display.theme));

        fetchNui('getRadioData').then('ok');

        const handler = (e) => {
            const d = e.data;
            if (!d?.type) return;

            if (d.type === 'radioUpdate') {
                setInRadio(d.inRadio);
                setFrequency(d.frequency || '');
                setMembers(d.members || []);
                if (d.isStaff !== undefined) setIsStaff(d.isStaff);
            }
            if (d.type === 'radioMembersUpdate') {
                setMembers(d.members || []);
            }
            if (d.type === 'memberTalking') {
                setMembers((prev) =>
                    prev.map((m) => ({ ...m, talking: m.id === d.id ? d.talking : m.talking }))
                );
            }
            if (d.type === 'radio:kicked') {
                setInRadio(false);
                setFrequency('');
                setMembers([]);
                showNotif('Vous avez été expulsé du canal', 'error');
            }
        };

        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    useEffect(() => {
        if (devMode) return;
        fetchNui('setRadioVolume', { volume: soundEnabled ? volume / 100 : 0 });
    }, [volume, soundEnabled]);

    useEffect(() => {
        if (devMode) return;
        fetchNui('setStreamerMode', { enabled: streamerMode });
    }, [streamerMode]);

    const handleJoin = () => {
        const freq = parseFloat(inputFreq);
        if (!inputFreq || isNaN(freq) || freq < 0 || freq > 999.999) {
            showNotif('Fréquence invalide (ex: 100.500)', 'error');
            return;
        }
        const nick = inputNick.trim();

        if (devMode) {
            setFrequency(inputFreq);
            setNickname(nick || 'Jean Dupont');
            setInRadio(true);
            setMembers([
                { id: 1, name: nick || 'Jean Dupont', talking: false, self: true },
                { id: 2, name: 'Dispatch', talking: false },
                { id: 3, name: 'Alpha-1', talking: true },
            ]);
            showNotif(`Connecté sur ${inputFreq} MHz`, 'success');
            return;
        }

        fetchNui('joinRadio', { frequency: inputFreq, nickname: nick }).then((res) => {
            if (res?.success) {
                setNickname(nick);
                showNotif(`Connecté sur ${inputFreq} MHz`, 'success');
            } else {
                showNotif(res?.error || 'Erreur de connexion', 'error');
            }
        });
    };

    const handleLeave = () => {
        if (devMode) {
            setInRadio(false);
            setFrequency('');
            setMembers([]);
            setInputFreq('');
            showNotif('Radio déconnectée', 'info');
            return;
        }
        fetchNui('leaveRadio').then(() => {
            setInRadio(false);
            setFrequency('');
            setMembers([]);
            showNotif('Radio déconnectée', 'info');
        });
    };

    const handleSound = () => {
        const newState = !soundEnabled;
        setSoundEnabled(newState);
        fetchNui('setMicClicks', { enabled: newState });
    };

    const handleKick = (id, name) => {
        if (devMode) {
            setMembers((prev) => prev.filter((m) => m.id !== id));
            showNotif(`${name} expulsé`, 'error');
            return;
        }
        fetchNui('kickFromRadio', { id }).then((res) => {
            if (res?.success) showNotif(`${name} expulsé`, 'error');
        });
    };

    const handleRename = (id) => {
        const val = renameValue.trim();
        if (!val) return;
        if (devMode) {
            setMembers((prev) => prev.map((m) => m.id === id ? { ...m, name: val } : m));
            setRenamingId(null);
            setRenameVal('');
            showNotif('Renommé avec succès', 'success');
            return;
        }
        fetchNui('renameMember', { id, name: val }).then((res) => {
            if (res?.success) {
                setRenamingId(null);
                setRenameVal('');
                showNotif('Renommé avec succès', 'success');
            }
        });
    };

    const handleListe = () => {
        const newState = !listeActive;
        if (devMode) {
            setListeActive(newState);
            showNotif(`Liste ${newState ? 'activée' : 'désactivée'}`, newState ? 'success' : 'info');
            return;
        }
        fetchNui('toggleListe', { active: newState }).then((res) => {
            if (res?.success) {
                setListeActive(newState);
                showNotif(`Liste ${newState ? 'activée' : 'désactivée'}`, newState ? 'success' : 'info');
            }
        });
    };

    const handleSelfRename = () => {
        const nick = inputNick.trim();
        if (!nick) return;
        if (devMode) {
            setNickname(nick);
            setMembers((prev) => prev.map((m) => m.self ? { ...m, name: nick } : m));
            showNotif('Pseudo mis à jour', 'success');
            return;
        }
        fetchNui('renameself', { nickname: nick }).then((res) => {
            if (res?.success) {
                setNickname(nick);
                showNotif('Pseudo mis à jour', 'success');
            }
        });
    };

    const volIcon = volume === 0
        ? <path d='M11 5L6 9H2v6h4l5 4V5z' />
        : volume < 50
            ? <><path d='M11 5L6 9H2v6h4l5 4V5z' /><path d='M15.54 8.46a5 5 0 0 1 0 7.07' /></>
            : <><path d='M11 5L6 9H2v6h4l5 4V5z' /><path d='M19.07 4.93a10 10 0 0 1 0 14.14' /><path d='M15.54 8.46a5 5 0 0 1 0 7.07' /></>;

    return (
        <AppProvider theme={theme}>
            <div className='app' ref={appDiv} data-theme={theme}>

                {notification && (
                    <div className={`notif notif-${notification.type}`}>
                        <span className='notif-dot' />
                        {notification.msg}
                    </div>
                )}

                <div className='radio-app'>
                    <div className='radio-header'>
                        <div className='radio-logo'>
                            <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                <path d='M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' />
                                <path d='M19 10v2a7 7 0 0 1-14 0v-2' />
                                <line x1='12' y1='19' x2='12' y2='23' />
                                <line x1='8' y1='23' x2='16' y2='23' />
                            </svg>
                            <span>RADIO</span>
                        </div>
                        <div className='radio-status-badge'>
                            <span className={`status-dot ${inRadio ? 'on' : 'off'}`} />
                            {inRadio ? (
                                <span className={streamerMode ? 'freq-blurred' : ''}>{frequency} MHz</span>
                            ) : 'HORS LIGNE'}
                        </div>
                    </div>

                    <div className='tabs'>
                        <button className={`tab ${activeTab === 'radio' ? 'active' : ''}`} onClick={() => setActiveTab('radio')}>
                            CANAL
                        </button>
                        <button className={`tab ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
                            MEMBRES {members.length > 0 && <span className='badge'>{members.length}</span>}
                        </button>
                        {inRadio && (
                            <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                                OPTIONS
                            </button>
                        )}
                    </div>

                    <div className='tab-content'>

                        {activeTab === 'radio' && (
                            <div className='panel'>
                                {!inRadio ? (
                                    <div className='join-panel'>
                                        <div className='field-group'>
                                            <label className='field-label'>FRÉQUENCE (MHz)</label>
                                            <div className='freq-input-wrap'>
                                                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                                    <path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.38 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' />
                                                </svg>
                                                <input className='freq-input' type='number' step='0.001' min='0' max='999.999' placeholder='100.500'
                                                    value={inputFreq} onChange={(e) => setInputFreq(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()} />
                                            </div>
                                        </div>
                                        <div className='field-group'>
                                            <label className='field-label'>PSEUDO (optionnel)</label>
                                            <div className='freq-input-wrap'>
                                                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                                    <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' /><circle cx='12' cy='7' r='4' />
                                                </svg>
                                                <input className='freq-input' type='text' placeholder='Nom Prénom RP par défaut' value={inputNick} maxLength={20}
                                                    onChange={(e) => setInputNick(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()} />
                                            </div>
                                        </div>

                                        <button className='btn-join' onClick={handleJoin}>
                                            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                                                <path d='M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z' />
                                                <path d='M19 10v2a7 7 0 0 1-14 0v-2' />
                                            </svg>
                                            REJOINDRE LE CANAL
                                        </button>
                                    </div>
                                ) : (
                                    <div className='active-panel'>
                                        <div className='freq-display'>
                                            <div className='freq-label'>FRÉQUENCE ACTIVE</div>
                                            <div className={`freq-value ${streamerMode ? 'freq-blurred' : ''}`}>{frequency} <span>MHz</span></div>
                                        </div>
                                        <div className='nick-display'>
                                            <div className='freq-label'>IDENTIFIANT</div>
                                            <div className='nick-value'>{nickname}</div>
                                        </div>

                                        <div className='volume-block'>
                                            <div className='volume-header'>
                                                <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                                    {volIcon}
                                                </svg>
                                                <span className='field-label' style={{ margin: 0 }}>VOLUME RADIO</span>
                                                <span className='volume-value'>{volume}%</span>
                                            </div>
                                            <div className='slider-wrap'>
                                                <input
                                                    className='volume-slider'
                                                    type='range'
                                                    min='0'
                                                    max='100'
                                                    value={volume}
                                                    onChange={(e) => setVolume(Number(e.target.value))}
                                                />
                                                <div className='slider-fill' style={{ width: `${volume}%` }} />
                                            </div>
                                        </div>

                                        <button className='btn-leave' onClick={handleLeave}>
                                            <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                                                <line x1='18' y1='6' x2='6' y2='18' /><line x1='6' y1='6' x2='18' y2='18' />
                                            </svg>
                                            QUITTER LE CANAL
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'members' && (
                            <div className='panel'>
                                {members.length === 0 ? (
                                    <div className='empty-state'>
                                        <svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5'>
                                            <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' /><circle cx='9' cy='7' r='4' />
                                            <path d='M23 21v-2a4 4 0 0 0-3-3.87' /><path d='M16 3.13a4 4 0 0 1 0 7.75' />
                                        </svg>
                                        <p>Aucun membre sur ce canal</p>
                                    </div>
                                ) : (
                                    <div className='members-list'>
                                        {members.map((m) => (
                                            <div key={m.id} className={`member-row ${m.talking ? 'talking' : ''} ${m.self ? 'self' : ''}`}>
                                                {renamingId === m.id ? (
                                                    <div className='rename-form'>
                                                        <input autoFocus className='rename-input' value={renameValue} placeholder={m.name} maxLength={20}
                                                            onChange={(e) => setRenameVal(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleRename(m.id);
                                                                if (e.key === 'Escape') { setRenamingId(null); setRenameVal(''); }
                                                            }} />
                                                        <button className='rename-confirm' onClick={() => handleRename(m.id)}>✓</button>
                                                        <button className='rename-cancel' onClick={() => { setRenamingId(null); setRenameVal(''); }}>✕</button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className='member-info'>
                                                            <div className={`member-avatar ${m.talking ? 'talking' : ''}`}>
                                                                {m.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className='member-name'>
                                                                    {m.name} {m.self && <span className='self-tag'>VOUS</span>}
                                                                </div>
                                                                {m.talking && <div className='talking-label'>EN TRAIN DE PARLER...</div>}
                                                            </div>
                                                        </div>
                                                        {isStaff && !m.self && (
                                                            <div className='member-actions'>
                                                                <button className='action-btn rename-btn' title='Renommer'
                                                                    onClick={() => { setRenamingId(m.id); setRenameVal(m.name); }}>
                                                                    <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                                                                        <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
                                                                        <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
                                                                    </svg>
                                                                </button>
                                                                <button className='action-btn kick-btn' title='Expulser'
                                                                    onClick={() => handleKick(m.id, m.name)}>
                                                                    <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5'>
                                                                        <line x1='18' y1='6' x2='6' y2='18' /><line x1='6' y1='6' x2='18' y2='18' />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && inRadio && (
                            <div className='panel'>
                                <div className='field-group'>
                                    <label className='field-label'>CHANGER DE PSEUDO</label>
                                    <div className='freq-input-wrap'>
                                        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                            <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' /><circle cx='12' cy='7' r='4' />
                                        </svg>
                                        <input className='freq-input' type='text' placeholder={nickname || 'Nom Prénom RP'}
                                            value={inputNick} maxLength={20}
                                            onChange={(e) => setInputNick(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSelfRename()} />
                                    </div>
                                    <button className='btn-action' onClick={handleSelfRename}>METTRE À JOUR</button>
                                </div>
                                <div className='divider' />
                                <div className='field-group'>
                                    <label className='field-label'>CHANGER DE FRÉQUENCE</label>
                                    <div className='freq-input-wrap'>
                                        <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                            <path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.38 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' />
                                        </svg>
                                        <input className='freq-input' type='number' step='0.001' min='0' max='999.999' placeholder='Nouvelle fréquence'
                                            value={inputFreq} onChange={(e) => setInputFreq(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleJoin()} />
                                    </div>
                                    <button className='btn-action' onClick={handleJoin}>CHANGER DE CANAL</button>
                                </div>
                                <div className='divider' />
                                <div className='field-group'>
                                    <label className='field-label'>BRAVE RADIO LIST</label>
                                    <button className={`btn-toggle ${listeActive ? 'active' : ''}`} onClick={handleListe}>
                                        <span className={`toggle-dot ${listeActive ? 'on' : 'off'}`} />
                                        {listeActive ? 'LISTE ACTIVÉE' : 'LISTE DÉSACTIVÉE'}
                                    </button>
                                </div>
                                <div className='divider' />
                                <div className='field-group'>
                                    <label className='field-label'>MODE STREAMER</label>
                                    <button className={`btn-toggle ${streamerMode ? 'active' : ''}`} onClick={() => setStreamerMode(v => !v)}>
                                        <span className={`toggle-dot ${streamerMode ? 'on' : 'off'}`} />
                                        <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                            {streamerMode
                                                ? <><path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94'/><path d='M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19'/><line x1='1' y1='1' x2='23' y2='23'/></>
                                                : <><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z'/><circle cx='12' cy='12' r='3'/></>
                                            }
                                        </svg>
                                        {streamerMode ? 'FRÉQUENCE MASQUÉE' : 'FRÉQUENCE VISIBLE'}
                                    </button>
                                </div>
                                <div className='divider' />
                                <div className='field-group'>
                                    <label className='field-label'>BIP DE LA RADIO</label>
                                    <button className={`btn-toggle ${soundEnabled ? 'active' : ''}`} onClick={handleSound}>
                                        <svg width='13' height='13' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                            {soundEnabled
                                                ? <><path d='M11 5L6 9H2v6h4l5 4V5z' /><path d='M19.07 4.93a10 10 0 0 1 0 14.14' /><path d='M15.54 8.46a5 5 0 0 1 0 7.07' /></>
                                                : <><path d='M11 5L6 9H2v6h4l5 4V5z' /><line x1='23' y1='9' x2='17' y2='15' /><line x1='17' y1='9' x2='23' y2='15' /></>
                                            }
                                        </svg>
                                        {soundEnabled ? 'BIP ACTIVÉ' : 'BIP COUPÉ'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className='radio-footer'>
                        {isStaff && <span className='staff-badge'>⬡ STAFF</span>}
                        <span className='footer-hint'>
                            {inRadio ? `${members.length} connecté${members.length > 1 ? 's' : ''}` : 'Entrez une fréquence pour rejoindre'}
                        </span>
                    </div>
                </div>
            </div>
        </AppProvider>
    );
};

const AppProvider = ({ children, theme }) => {
    if (devMode) {
        return <div className='dev-wrapper'><Frame>{children}</Frame></div>;
    }
    return children;
};

export default App;
