import * as THREE from 'three';
const D = window.GCC_DATA;
const W = D.W, H = D.H;
const $ = id => document.getElementById(id);
const status = (t, f) => { $('status').textContent = t; if (f != null) $('bar').firstChild.style.width = (f * 100) + '%'; };
const tick = () => new Promise(r => setTimeout(r, 0));

