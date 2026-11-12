// Textele pentru paginile de contact. Cheile sunt cod; valorile sunt afișate utilizatorilor.
// Placeholderele dintre acolade ({max}, {min}, {email}, {count}) trebuie păstrate neschimbate.

export const CONTACT_PATHS = {
  hub: "/contact/",
  general: "/contact/mesaj/",
  station: "/contact/radio-nou/",
  announcement: "/contact/anunt/",
} as const;

export const CONTACT_COPY = {
  common: {
    backToHub: "Toate opțiunile de contact",
    optional: "(opțional)",
    send: "Trimite",
    sending: "Se trimite…",
    charCount: "{count}/{max}",
    yourDetails: "Datele tale de contact",
    yourDetailsHint: "Le folosim doar ca să-ți răspundem.",
    privacyPrefix: "Trimițând mesajul, ești de acord să-l păstrăm ca să-ți putem răspunde. Citește",
    privacyLink: "politica de confidențialitate",
    successTitle: "Mulțumim!",
    successBody: "Am primit mesajul tău. Îți vom răspunde la {email} cât de curând putem.",
    successAgain: "Trimite un alt mesaj",
    successHome: "Înapoi la posturile de radio",
    errorBanner: "Te rugăm să verifici câmpurile marcate cu roșu.",
    rateLimited: "Ai trimis mai multe mesaje într-un timp scurt. Așteaptă câteva minute și încearcă din nou.",
    tooLarge: "Pozele sunt prea mari împreună. Șterge una sau două și încearcă din nou.",
    network: "Nu am putut trimite mesajul. Verifică dacă ai internet și încearcă din nou.",
    server: "A apărut o problemă la noi. Te rugăm să încerci din nou peste câteva minute.",
    whatsappPrefix: "Vrei să vorbești pe WhatsApp?",
    whatsappLink: "Scrie-ne pe WhatsApp",
    chooseOption: "Alege…",
  },
  contactFields: {
    name: { label: "Numele tău", placeholder: "Prenume și nume" },
    email: { label: "Adresa ta de e-mail", hint: "Îți vom răspunde aici.", placeholder: "nume@exemplu.ro" },
    phone: { label: "Telefon / WhatsApp", hint: "Dacă preferi să te sunăm sau să-ți scriem pe WhatsApp." },
  },
  images: {
    add: "Adaugă poze",
    addOne: "Adaugă o poză",
    remove: "Șterge poza",
    limit: "Cel mult {max} poze (JPG, PNG sau WebP).",
    limitOne: "O poză (JPG, PNG sau WebP).",
    processing: "Se pregătește poza…",
  },
  errors: {
    required: "Te rugăm să completezi acest câmp.",
    too_long: "Te rugăm să scrii cel mult {max} caractere.",
    too_short: "Te rugăm să scrii puțin mai mult (cel puțin {min} caractere).",
    invalid_email: "Adresa de e-mail nu pare corectă. Verific-o, te rugăm.",
    invalid_url: "Linkul nu pare corect. Trebuie să înceapă cu https://",
    invalid_choice: "Te rugăm să alegi una dintre opțiuni.",
    invalid_date: "Te rugăm să alegi o dată validă.",
    end_before_start: "Data de sfârșit trebuie să fie după data de început.",
    unknown_station: "Te rugăm să alegi un post de radio din listă.",
    too_many_files: "Poți adăuga cel mult {max} poze.",
    file_too_large: "Poza este prea mare (cel mult 10 MB).",
    unsupported_image: "Nu putem folosi acest fișier. Alege o poză JPG, PNG sau WebP.",
    image_too_large_dimensions: "Poza are dimensiuni prea mari. Alege una mai mică.",
    need_website_or_listen_url: "Adaugă cel puțin un link: site-ul postului sau pagina unde poate fi ascultat.",
    captcha_failed: "Te rugăm să confirmi că nu ești robot și să încerci din nou.",
  },
  hub: {
    seoTitle: "Contact | Radio Creștin",
    seoDescription:
      "Scrie echipei Radio Creștin: trimite un mesaj, recomandă un post de radio creștin sau cere publicarea unui anunț în aplicație și pe site.",
    title: "Contactează-ne",
    intro: "Spune-ne cu ce te putem ajuta. Alege varianta potrivită; durează doar câteva minute.",
    cards: {
      general: { title: "Trimite-ne un mesaj", text: "Întrebări, idei sau o problemă cu aplicația ori cu un post de radio." },
      station: { title: "Adaugă un post de radio", text: "Lipsește un post creștin pe care îl asculți? Spune-ne despre el." },
      announcement: {
        title: "Cere publicarea unui anunț",
        text: "Un eveniment, o campanie sau o veste de la postul tău ori de la biserică, afișată în aplicație și pe site.",
      },
    },
  },
  general: {
    seoTitle: "Trimite-ne un mesaj | Radio Creștin",
    seoDescription: "Scrie echipei Radio Creștin cu întrebări, sugestii sau probleme legate de aplicație ori de un post de radio.",
    title: "Trimite-ne un mesaj",
    intro: "Scrie-ne despre orice: o întrebare, o idee sau ceva care nu funcționează.",
    fields: {
      message: { label: "Mesajul tău", placeholder: "Scrie mesajul aici…" },
      images: { label: "Capturi de ecran sau poze", hint: "Dacă ceva nu funcționează, o captură de ecran ne ajută mult." },
    },
  },
  station: {
    seoTitle: "Adaugă un post de radio creștin | Radio Creștin",
    seoDescription:
      "Recomandă un post de radio creștin pentru Radio Creștin. Spune-ne numele și site-ul, iar noi îl vom verifica și adăuga în aplicație și pe site.",
    title: "Adaugă un post de radio",
    intro:
      "Spune-ne despre post, iar noi îl vom verifica și îl vom adăuga. Nu ai nevoie de detalii tehnice: ajunge un link către site-ul postului.",
    sections: { station: "Despre post", extra: "Alte detalii" },
    fields: {
      station_name: { label: "Numele postului", placeholder: "de exemplu, Radio Vocea Evangheliei" },
      website: { label: "Site-ul postului", placeholder: "https://", hint: "Adresa postului pe internet." },
      listen_url: {
        label: "Linkul pentru ascultare",
        placeholder: "https://",
        hint: "Pagina unde apeși pe Redă sau linkul transmisiei, dacă îl știi.",
      },
      description: {
        label: "Scurtă descriere",
        hint: "Ce transmite (muzică, predici, emisiuni) și din ce loc transmite.",
      },
      denomination: {
        label: "De ce biserică sau confesiune aparține?",
        options: {
          pentecostal: "Penticostal",
          baptist: "Baptist",
          brethren: "Creștini după Evanghelie",
          adventist: "Adventist",
          orthodox: "Ortodox",
          lords_army: "Oastea Domnului",
          roman_catholic: "Romano-Catolic",
          greek_catholic: "Greco-Catolic",
          reformed: "Reformat",
          lutheran: "Luteran",
          evangelical: "Biserica Evanghelică Română",
          nondenominational: "Interconfesional",
          other: "Altă confesiune",
          unknown: "Nu știu",
        },
      },
      denomination_other: { label: "Care anume?", placeholder: "Numele bisericii sau confesiunii" },
      mission: {
        label: "Care este scopul postului?",
        hint: "De exemplu: vestirea Evangheliei, muzică de închinare, învățătură biblică sau slujirea unei biserici ori comunități locale.",
      },
      logo: { label: "Logo-ul postului", hint: "Cel mai bine se vede o imagine pătrată." },
      station_email: { label: "Adresa de e-mail a postului", hint: "Adresa la care poate fi contactat postul." },
      facebook_url: { label: "Pagina de Facebook", placeholder: "https://facebook.com/..." },
      note: { label: "Mai este ceva ce ar trebui să știm?" },
    },
  },
  announcement: {
    seoTitle: "Cere publicarea unui anunț | Radio Creștin",
    seoDescription:
      "Împărtășește cu ascultătorii Radio Creștin un eveniment, o campanie sau o veste de la postul tău creștin ori de la biserică, în aplicație și pe site.",
    title: "Cere publicarea unui anunț",
    intro:
      "Anunțurile apar într-un chenar mic în aplicația Radio Creștin și pe site. Completează detaliile, iar noi îl pregătim împreună cu tine.",
    sections: { what: "Despre anunț", when: "Când să apară?", pictures: "Poze" },
    fields: {
      about: {
        label: "Despre ce este anunțul?",
        options: {
          station: "Despre ceva ce se întâmplă la un post de radio",
          general: "Despre un alt eveniment sau o altă veste",
        },
        optionHints: {
          station: "O emisiune nouă, o transmisie specială, un eveniment sau o campanie a postului.",
          general: "Un eveniment la biserică, un concert, o conferință sau o campanie.",
        },
      },
      station_slug: { label: "Ce post de radio?", placeholder: "Alege postul" },
      title: {
        label: "Titlu",
        hint: "Scurt și clar, ca să se înțeleagă bine în chenar.",
        placeholder: "de exemplu, Concert de Crăciun la Cluj",
      },
      summary: { label: "Text scurt", hint: "Una sau două propoziții care apar sub titlu." },
      details: {
        label: "Mai multe detalii",
        hint: "Text mai lung pentru pagina anunțului: program, adresă, cum poți participa.",
      },
      link: {
        label: "Link cu mai multe informații",
        placeholder: "https://",
        hint: "Un site, un eveniment de pe Facebook sau un formular de înscriere.",
      },
      starts_on: { label: "De la", hint: "Lasă necompletat ca să apară imediat ce este gata." },
      ends_on: { label: "Până la", hint: "Lasă necompletat dacă nu are o dată de încheiere." },
      images: { label: "Poze", hint: "Un afiș sau o fotografie. Prima poză va fi coperta." },
    },
  },
};
