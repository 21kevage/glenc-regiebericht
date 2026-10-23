# Glenc Regiebericht

Installierbare PWA für Regieberichte im Innenausbau. Sie läuft responsive auf Android, Tablet und Desktop und funktioniert auch ohne Netzverbindung. Die Berichte werden zunächst lokal auf dem jeweiligen Gerät gespeichert.

Zusätzlich wird über GitHub Actions eine Android-Test-APK erzeugt. Sie enthält dieselbe App wie die PWA, läuft ohne Browser und kann per Sideload auf Android installiert werden.

## Lokal starten

```bash
npm run web:build
npx serve www
```

Danach `http://localhost:3000` öffnen. Für eine Installation als App muss die Anwendung über HTTPS bereitgestellt werden, zum Beispiel über GitHub Pages.

## Android-APK

```bash
npm run android:apk
```

Die fertige Test-APK liegt danach unter `android/app/build/outputs/apk/debug/app-debug.apk`. Auf dem Android-Gerät muss für die verwendete Dateien-App die Installation unbekannter Apps erlaubt werden. Die Debug-APK ist für interne Tests gedacht; für eine Veröffentlichung im Play Store wird später ein eigener Release-Schlüssel benötigt.

## Bedienung

1. Projekt und Datum erfassen.
2. Mitarbeiter als Facharbeiter oder Helfer anlegen, für den Bericht auswählen und je Tätigkeitsposition die Stunden zuordnen.
3. Unterschrift direkt mit Finger, Stift oder Maus einzeichnen.
4. **PDF erstellen & speichern** erzeugt eine echte PDF-Datei mit Logo, Mitarbeiteraufteilung und Unterschrift.
   - Im Browser und unter Windows wird sie direkt heruntergeladen.
   - In der Android-APK öffnet sich der Systemdialog. Dort kann sie z. B. in Google Drive oder auf dem Gerät gespeichert werden.

Auf Android kann in einem großen Textfeld die Handschrifteingabe der installierten Tastatur (z. B. Gboard/Samsung Tastatur) genutzt werden. Eine direkte, browserübergreifende Stift-zu-Text-API gibt es nicht zuverlässig, deshalb nutzt die App die vorhandene Geräteeingabe.

## Geräteübergreifende Nutzung

Die PWA selbst lässt sich auf allen Geräten installieren. Für denselben Berichtsspeicher auf mehreren Geräten wird ein Cloud-Backend benötigt. Der nächste sinnvolle Schritt ist ein kleines Supabase-Projekt mit Anmeldung für Dawid, synchronisierten Entwürfen und PDF-Archiv. Diese Zugangsdaten gehören nicht in das Repository.

## Firmendaten

Die im PDF verwendeten Unternehmensdaten stammen aus dem Impressum von glenc-innenausbau.de und können zentral in `app.js` angepasst werden.
