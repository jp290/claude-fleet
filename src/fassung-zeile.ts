// DIE ZEILE „Fassung 6ace66f1“: vor dem Start im Start-Block des Fensters, am laufenden Sitz im Setup-Block des Boards. Beide kürzen gleich,
// damit man sie mit einem Blick vergleicht; der volle Hash steht im Tooltip (GET /api/slots/:id/fassung zeigt, was darin steckt).
export const FASSUNG_LAENGE = 8;
export const fassungKurz = (hash: string): string => hash.slice(0, FASSUNG_LAENGE);
export const fassungZeile = (hash: string): string => `Fassung ${fassungKurz(hash)}`;
