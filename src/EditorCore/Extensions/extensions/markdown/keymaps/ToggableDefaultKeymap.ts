// src/EditorCore/Extensions/extensions/markdown/keymaps/ToggableDefaultKeymap.ts

import { defaultKeymap } from '@codemirror/commands';
import { EditorView, KeyBinding, keymap } from '@codemirror/view'; // Ensure 'keymap' is imported
import { Compartment, Extension } from '@codemirror/state';

/**
 * Manages the dynamic toggling of individual keybindings within CodeMirror's defaultKeymap.
 */

const disabledDefaultKeys: Set<string> = new Set();
const keymapCompartment = new Compartment();

function buildFilteredDefaultKeymap(): KeyBinding[] {
    return defaultKeymap.filter(binding => {
        const keysToCheck = Array.isArray(binding.key) ? binding.key : [binding.key];
        return !keysToCheck.some(key => disabledDefaultKeys.has(key));
    });
}

/**
 * The initial extension for the toggable default keymap.
 * This should be included in your editor's main extensions list.
 */
export const toggableDefaultKeymapExtension: Extension = keymapCompartment.of(keymap.of(buildFilteredDefaultKeymap()));

export function disableDefaultKey(view: EditorView, key: string): void {
    if (!disabledDefaultKeys.has(key)) {
        disabledDefaultKeys.add(key);
        console.log(`Default keymap: Disabling key "${key}"`);
        view.dispatch({
            effects: keymapCompartment.reconfigure(keymap.of(buildFilteredDefaultKeymap()))
        });
    } else {
        console.log(`Default keymap: Key "${key}" is already disabled.`);
    }
}

export function enableDefaultKey(view: EditorView, key: string): void {
    if (disabledDefaultKeys.has(key)) {
        disabledDefaultKeys.delete(key);
        console.log(`Default keymap: Enabling key "${key}"`);
        view.dispatch({
            effects: keymapCompartment.reconfigure(keymap.of(buildFilteredDefaultKeymap()))
        });
    } else {
        console.log(`Default keymap: Key "${key}" is already enabled.`);
    }
}

export function isDefaultKeyDisabled(key: string): boolean {
    return disabledDefaultKeys.has(key);
}

export function getAllDefaultKeyStrings(): Set<string> {
    const allKeys = new Set<string>();
    defaultKeymap.forEach(binding => {
        const keys = Array.isArray(binding.key) ? binding.key : [binding.key];
        keys.forEach(key => allKeys.add(key));
    });
    return allKeys;
}