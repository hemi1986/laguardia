import { attachedNowParts, filesCount } from "./file-plurals";

/**
 * The team UI's texts of the Collection context about files (BC-Collection, architecture review 2026-11-06): the file
 * details, the overview, attaching, adding, removing. The rest of Collection's texts are `collectionTexts`
 * (`./collection`); both are spread into `teamMessages`, and a text key lives in one of them only (a test checks it).
 */
export const collectionFilesTexts = {
  /** The file details (RM-FileDetails, ST-114, G18): one file's page – what it is, what it is attached to, how far the AI index got. */
  fileDetails: {
    /** „Handbuch · PDF · 12,4 MB“ (G13). */
    head: (category: string, mediaType: string, size: string) => `${category} · ${mediaType} · ${size}`,
    mediaTypes: {
      pdf: "PDF",
      png: "PNG",
      jpeg: "JPEG",
      webp: "WebP",
      markdown: "Markdown",
      text: "Text",
      video: "Video",
      audio: "Audio",
      other: "Anderes Format",
    },
    addedBy: (name: string, date: string) => `Hinzugefügt von ${name} am ${date}`,
    /** The confirmation after „Datei hinzufügen“ (ST-119, G3). */
    added: (title: string) => `„${title}“ hinzugefügt.`,
    /** The name the file had on the team member's device (ST-119, CONTEXT.md: Original file name). */
    originalFileName: (name: string) => `Ursprünglicher Dateiname: ${name}`,
    open: "Datei öffnen",
    attachedTo: "Angehängt an",
    machine: (museumNumber: string, machineModelTitle: string) => `${museumNumber} · ${machineModelTitle}`,
    retiredMachine: (museumNumber: string) => `${museumNumber} · Ausgemustert`,
    machineModel: (title: string) => `Alle Geräte des Modells ${title}`,
    /** A file attached to nothing – the data model allows it; ST-115 is where it first occurs. */
    nowhere: "Nirgends angehängt",
    /** At the end of „Angehängt an“ (ST-115, G18): the way to the form that attaches this file to further things. */
    attach: "Anhängen",
    /** On each entry of „Angehängt an“, technicians only (ST-115, G10a): one tap, no question. */
    detach: "Lösen",
    /** The confirmation after attaching (ST-115, G3, G33): the resulting state, only the parts there are. */
    attachedNow: (title: string, machines: number, models: number) => {
      const parts = attachedNowParts(machines, models);
      if (parts.length === 0) return `„${title}“ hängt jetzt nirgends.`;
      return `„${title}“ hängt jetzt an ${parts.join(" und ")}.`;
    },
    /** The confirmation after detaching one thing (ST-115, G3) – the file stays a file. */
    detachedFrom: (title: string, name: string) => `„${title}“ von ${name} gelöst.`,
    /** In the head of the page (ST-116, G18): the way to the form that corrects the title and the file category. */
    edit: "Datei bearbeiten",
    /** The confirmation after a correction (ST-116, G3, G33) – also when nothing changed. */
    saved: (title: string) => `„${title}“ gespeichert.`,
    /** The way back from the attach form (ST-115, G17). */
    backToFile: "Zurück zur Datei",
    /** A removed file's details address after a detach attempt (ST-115): the rejection, not the details. */
    removedTitle: "Datei entfernt",
    /** The way back, by where the person came from (G17, closed set of origins). */
    backToMachine: "Zurück zum Gerät",
    backToSettings: "Zurück zu den Einstellungen",
    backToFiles: "Zurück zu den Dateien",
  },
  /** Correcting a file's title and file category (ST-116, G34): the form behind „Datei bearbeiten“. */
  changeFileDetails: {
    pageTitle: (fileTitle: string) => `Datei bearbeiten · ${fileTitle}`,
    title: "Titel",
    fileCategory: "Dateikategorie",
    /** Only after a form was sent without a file category – the choice has no empty entry otherwise (G20). */
    choose: "Bitte wählen",
    submit: "Datei speichern",
  },
  /** Attaching an existing file to further machines and machine models (ST-115, RM-AttachmentChoice, G27). */
  attachToFile: {
    title: (fileTitle: string) => `Anhängen · ${fileTitle}`,
    machines: "Geräte",
    machineModels: "Modelle",
    /** Nothing left to offer (G7): the page says so and has no submit. */
    nothingLeft: "Es gibt nichts mehr, woran sich diese Datei anhängen lässt.",
    submit: "Anhängen",
  },
  /**
   * The file overview (RM-FileOverview, ST-117, G18, G40): finding a file. The AI index states are AI assistance's words
   * (`aiIndex.fileState`, `aiIndex.unreadable`).
   */
  fileOverview: {
    title: "Dateien",
    /** „42 Dateien“, and with more than one page „42 Dateien · Seite 2 von 2“ (G4, G40). */
    count: (files: number, page: number, pages: number) => {
      const count = filesCount(files);
      return pages > 1 ? `${count} · Seite ${page} von ${pages}` : count;
    },
    /** The search (ST-118, G32): its own form beside the filters, sent with „Suchen“. */
    searchForm: "Dateien durchsuchen",
    search: "Suche",
    searchSubmit: "Suchen",
    /** Under the field: what is searched – and that the content of indexed files only is. */
    searchHint:
      "Sucht im Titel, im ursprünglichen Dateinamen, in den Namen der Geräte und Modelle und im Inhalt – im Inhalt nur bei Dateien, die für die KI erfasst sind. Gescannte Seiten ohne Text werden dort nicht gefunden.",
    /** Nothing matches the search (G7): the words and the filters stay as sent. */
    nothingFoundSearch: "Keine Datei passt zu dieser Suche.",
    /** The filters (G32): one form, sent with „Filtern“ (`filters.apply`). */
    filter: "Dateien filtern",
    fileCategory: "Dateikategorie",
    allFileCategories: "Alle Dateikategorien",
    attachedTo: "Angehängt an",
    all: "Alle",
    machines: "Geräte",
    machineModels: "Modelle",
    aiIndex: "KI-Erfassung",
    /** No file at all (G7); „Datei hinzufügen“ stands below it (ST-119). */
    empty: "Noch keine Dateien.",
    /** Directly under the heading (G2, ST-119): leads to the form page. */
    add: "Datei hinzufügen",
    /** Nothing matches (G7): the filters stay as sent. */
    nothingFound: "Keine Datei passt zu diesen Filtern.",
    showAll: "Alle Dateien anzeigen",
    /** Under the entries (G40), each only when there is a page to go to. */
    previous: "Zurück",
    next: "Weiter",
    pages: "Seiten",
  },
  /** The file categories (CONTEXT.md: Dateikategorie) – on the machine record and the form that attaches a file (ST-037). */
  fileCategories: { manual: "Handbuch", schematic: "Schaltplan", photo: "Foto", other: "Sonstiges" },
  /** Attaching a file (ST-037) – its own page, reached from the machine record's files section. */
  attachFile: {
    title: (museumNumber: string) => `Datei anhängen · ${museumNumber}`,
    /** Strings only below – the form is a client component. */
    form: {
      file: "Datei",
      fileHint: "Höchstens 100 MB, jedes Format. PDFs und Bilder lassen sich im Browser öffnen.",
      uploading: "Wird hochgeladen … {percent} %",
      uploaded: "Hochgeladen: {fileName}",
      title: "Titel",
      fileCategory: "Dateikategorie",
      choose: "Bitte wählen",
      attachTo: "Anhängen an",
      onlyMachine: "nur {museumNumber}",
      allMachinesOfModel: "alle Geräte des Modells {machineModel}",
      submit: "Datei anhängen",
      /** After a rejection of the form: whether the chosen file is still attached (G8a, user 2026-10-18). */
      stillAttached: "Die gewählte Datei ist noch angehängt: {fileName}",
      chooseAgain: "Die Datei muss erneut ausgewählt werden.",
      tooLarge: "Dateien dürfen höchstens 100 MB groß sein.",
      notUploaded: "Die Datei konnte nicht hochgeladen werden. Bitte noch einmal auswählen.",
    },
  },
  /** „Datei hinzufügen“ in the file overview (ST-119, G2a) – its own form page; a file may be attached to nothing yet. */
  addFileToOverview: {
    title: "Datei hinzufügen",
    back: "Zurück zu den Dateien",
    /** Strings only below – the form is a client component. */
    form: {
      file: "Datei",
      fileHint: "Höchstens 100 MB, jedes Format. PDFs und Bilder lassen sich im Browser öffnen.",
      uploading: "Wird hochgeladen … {percent} %",
      uploaded: "Hochgeladen: {fileName}",
      title: "Titel",
      fileCategory: "Dateikategorie",
      choose: "Bitte wählen",
      attachTo: "Anhängen an",
      attachToHint: "Freiwillig. Eine Datei darf auch erst einmal nirgends angehängt sein.",
      machines: "Geräte",
      machineModels: "Modelle",
      submit: "Datei hinzufügen",
      /** After a rejection of the form: whether the chosen file is still attached (G8a, user 2026-10-18). */
      stillAttached: "Die gewählte Datei ist noch angehängt: {fileName}",
      chooseAgain: "Die Datei muss erneut ausgewählt werden.",
      tooLarge: "Dateien dürfen höchstens 100 MB groß sein.",
      notUploaded: "Die Datei konnte nicht hochgeladen werden. Bitte noch einmal auswählen.",
    },
  },
  /** Attaching a camera photo as a file (ST-054) – its own page beside attaching a file; the file category is Photo. */
  attachPhoto: {
    title: (museumNumber: string) => `Foto anhängen · ${museumNumber}`,
    /** Strings only below – the form is a client component. */
    form: {
      photo: {
        label: "Foto",
        take: "Foto aufnehmen",
        choose: "Foto auswählen",
        remove: "Foto entfernen",
        preparing: "Foto wird vorbereitet …",
      },
      title: "Titel",
      attachTo: "Anhängen an",
      choose: "Bitte wählen",
      onlyMachine: "nur {museumNumber}",
      allMachinesOfModel: "alle Geräte des Modells {machineModel}",
      submit: "Foto anhängen",
      /** Sent without a photo – the page has no file to choose, only a photo to take (ST-054 code review). */
      photoRequired: "Bitte ein Foto aufnehmen oder auswählen.",
    },
  },
  /** Removing a file (ST-121): the question once, on a page of its own (G10, G10b), from the file details. */
  removeFile: {
    title: (fileTitle: string) => `Datei entfernen · ${fileTitle}`,
    question: (title: string) => `„${title}“ entfernen? Die Datei wird endgültig gelöscht.`,
    /** The list of machines and machine models follows, in the wording of „Angehängt an“ (G10b, ST-121). */
    disappearsFrom: "Sie verschwindet bei:",
    /** The button on the file details that leads to the question – an ordinary secondary button (G18, G30). */
    button: "Datei entfernen",
    /** The confirmation after the removal, wherever the person came from (G3). */
    removed: (title: string) => `„${title}“ entfernt.`,
    confirm: "Endgültig entfernen",
    back: "Zurück",
  },
} as const;
