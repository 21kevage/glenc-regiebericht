# Glenc Regiebericht

Installierbare PWA für Regieberichte im Innenausbau. Sie läuft responsive auf Android, Tablet und Desktop und funktioniert auch ohne Netzverbindung. Die Berichte werden zunächst lokal auf dem jeweiligen Gerät gespeichert.

## Lokal starten

```bash
npm start
```

Danach `http://localhost:3000` öffnen. Für eine Installation als App muss die Anwendung über HTTPS bereitgestellt werden, zum Beispiel über GitHub Pages.

## Bedienung

1. Projekt und Datum erfassen.
2. Tätigkeitspositionen mit Beschreibung und Stunden anlegen.
3. Unterschrift direkt mit Finger, Stift oder Maus einzeichnen.
4. **PDF erstellen** öffnet den aufgeräumten Druckdialog. Dort als Drucker **Als PDF speichern** wählen.

Auf Android kann in einem großen Textfeld die Handschrifteingabe der installierten Tastatur (z. B. Gboard/Samsung Tastatur) genutzt werden. Eine direkte, browserübergreifende Stift-zu-Text-API gibt es nicht zuverlässig, deshalb nutzt die App die vorhandene Geräteeingabe.

## Geräteübergreifende Nutzung

Die PWA selbst lässt sich auf allen Geräten installieren. Für denselben Berichtsspeicher auf mehreren Geräten wird ein Cloud-Backend benötigt. Der nächste sinnvolle Schritt ist ein kleines Supabase-Projekt mit Anmeldung für Dawid, synchronisierten Entwürfen und PDF-Archiv. Diese Zugangsdaten gehören nicht in das Repository.

## Firmendaten

Die im PDF verwendeten Unternehmensdaten stammen aus dem Impressum von glenc-innenausbau.de und können zentral in `app.js` angepasst werden.
