export type ContactChannel = 'whatsapp' | 'instagram' | 'facebook' | 'telegram' | 'webchat';

const WHATSAPP_SUFFIX_RE = /@(s\.whatsapp\.net|c\.us|lid)$/i;

export function normalizeContactPhone(rawPhone: string | null | undefined): string | null {
    if (rawPhone === null || rawPhone === undefined) return null;

    const raw = String(rawPhone).trim();
    if (!raw || raw.includes('@g.us')) return null;

    const withoutSuffix = raw.replace(WHATSAPP_SUFFIX_RE, '').split(':')[0];
    let digits = withoutSuffix.replace(/\D/g, '');
    if (!digits) return null;

    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }

    // WhatsApp Argentina suele usar 549 para celulares; evitamos duplicar 54/549.
    if (digits.startsWith('54') && !digits.startsWith('549') && digits.length >= 12) {
        digits = `549${digits.slice(2)}`;
    }

    return digits || null;
}

export function normalizeChannelValue(channel: ContactChannel, value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    if (channel === 'whatsapp') {
        return normalizeContactPhone(raw);
    }

    return raw;
}
