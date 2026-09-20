import os, itertools, statistics, numpy as np
from PIL import Image
S = os.environ["S"]
PAD, Z, SCHRITT, DPR = 8, 24, 32, 2
SESS = ["1","2","3","3A","3B","3C","4","4A","5","6","7","8","10","10A","11","12","13","15","16"]
SYS  = ["stroemung", "automat", "attraktor"]
HART = ["1", "3", "4", "15"]     # gleiches Projekt, gleiches Harness, keines schlafend

def zellen(datei):
    im = np.asarray(Image.open(datei).convert("RGB"), np.int16)
    out = {}
    for yi, sys in enumerate(SYS):
        for xi, slot in enumerate(SESS):
            x = (PAD + xi * SCHRITT) * DPR; y = (PAD + yi * SCHRITT) * DPR
            out[(sys, slot)] = im[y:y + Z * DPR, x:x + Z * DPR]
    return out

def mad(a, b): return float(np.abs(a - b).mean())

for datei, wie in ((S + "/shots/tafel.png", "in Farbe "), (S + "/shots/tafel-grau.png", "ohne Farbe")):
    z = zellen(datei)
    print(f"=== {wie} ===")
    for sys in SYS:
        ds = {(i, j): mad(z[(sys, i)], z[(sys, j)]) for i, j in itertools.combinations(SESS, 2)}
        vals = sorted(ds.values())
        near = sorted(ds.items(), key=lambda kv: kv[1])[:3]
        hart = [ds[(i, j)] for i, j in itertools.combinations(HART, 2)]
        # Tinte: wie viel von der Zelle ueberhaupt bemalt ist (Mittel ueber alle Marken)
        tinte = statistics.mean(float((c.max(axis=2) > 24).mean()) * 100 for k, c in z.items() if k[0] == sys)
        print(f"  {sys:10s} kleinster {vals[0]:5.2f} · Median {statistics.median(vals):5.2f} · "
              f"unter 4,0: {sum(1 for v in vals if v < 4):2d}/{len(vals)} · "
              f"Befund-(1)-Paare min {min(hart):5.2f} · Tinte {tinte:4.1f} %")
        print(f"  {'':10s} engste: " + "  ".join(f"{i}~{j} {d:.2f}" for (i, j), d in near))
