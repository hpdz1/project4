/**
 * Words that label the number after them, in the languages carrier emails are
 * written in. Sources: research/worldwide/tracking-formats-intl.md §8 (only
 * "tracking number", "AWB", "tracking id", "barcode", "waybill",
 * "Sendungsnummer" and "Paketnummer" are confirmed in real emails; the rest is
 * general language knowledge) and multilingual.md.
 *
 * Latin-script words must stand alone (no letter or digit on either side);
 * a trailing `\p{L}*` lets a stem take inflections ("przesyłki", "lähetyksesi").
 * CJK, Hangul, Arabic, Hebrew and Cyrillic labels match anywhere.
 */

const NOT_WORD = "[\\p{L}\\p{N}]";
const LATIN_ONLY_RE = /^[\x20-\x7EÀ-ɏ]*$/;

function labelRegex(words: readonly string[]): RegExp {
  const alts = words.map((w) => (LATIN_ONLY_RE.test(w) ? `(?<!${NOT_WORD})(?:${w})(?!${NOT_WORD})` : w));
  return new RegExp(alts.join("|"), "giu");
}

/** Labels that introduce a tracking number. */
export const POSITIVE_RE = labelRegex([
  // en
  "track", "tracking", "tracked", "trace", "waybill", "awb", "shipment", "shipments", "consignment",
  "parcel (?:number|no|id)", "article (?:number|id)", "barcode",
  // de
  "sendungsnummer\\p{L}*", "sendungs-?nr", "paketnummer\\p{L}*", "paket-?nr", "trackingnummer\\p{L}*",
  "sendungsverfolgung", "identcode", "sendung", "sendungen",
  // fr
  "suivi", "n[°º]\\s?de suivi", "num[ée]ro de (?:suivi|colis|l'envoi|d'envoi|d’envoi)", "lettre de transport",
  // nl
  "zending\\p{L}*", "pakketnummer", "verzending", "volgnummer",
  // es / pt
  "seguimiento", "n[úu]mero de (?:env[íi]o|gu[íi]a)", "c[óo]digo de (?:env[íi]o|rastreio|rastreamento)", "localizador",
  "rastreio", "rastreamento", "n[úu]mero do objeto", "seguimento", "env[íi]o",
  // it
  "spedizion\\p{L}*", "tracciamento", "lettera di vettura",
  // pl / cs / hu / ro
  "przesyłk\\p{L}*", "przesylk\\p{L}*", "numer nadania", "śledzeni\\p{L}*", "list przewozowy",
  "z[áa]silk\\p{L}*", "csomagsz[áa]m\\p{L}*", "küldemény\\p{L}*",
  // sv / no / da / fi
  "kolli\\p{L}*", "s[äa]ndning\\p{L}*", "sp[åa]rning\\p{L}*", "sending(?:s|en)?nummer", "sporing\\p{L}*",
  "pakkenummer", "forsendelse\\p{L}*", "stregkode", "lähety\\p{L}*", "lahety\\p{L}*", "seuranta\\p{L}*",
  // tr
  "takip", "g[öo]nderi\\p{L}*", "kargo",
  // ja / zh / ko
  "お問い合わせ番号", "問合せ番号", "追跡番号", "伝票番号", "送り状番号",
  "运单", "運單", "快递单号", "物流单号", "跟踪号", "追踪号", "追蹤", "單號",
  "운송장", "송장", "등기번호",
  // ar / he / ru / uk
  "رقم الشحنة", "رقم التتبع", "رقم البوليصة", "מספר מעקב", "трек", "отправлени", "відправлен", "ТТН", "ШПИ",
]);

/** Labels that introduce something that is *not* a tracking number. */
export const NEGATIVE_RE = labelRegex([
  // en (orders, money, accounts, references, phones, products, postcodes)
  "order", "orders", "invoice", "receipt", "transaction", "account", "acct", "customer", "member", "rewards",
  "ref", "reference", "case", "ticket", "claim", "rma", "booking", "reservation",
  "phone", "call", "tel", "telephone", "fax", "mobile", "hotline", "whatsapp",
  "sku", "item", "model", "serial", "isbn", "upc", "ean", "gtin", "qty", "quantity",
  "price", "total", "subtotal", "amount", "card", "gift", "promo", "coupon", "voucher", "pin", "routing",
  "zip", "zipcode", "postcode", "postal code", "vat", "tax id", "iban", "bic", "swift", "sort code",
  // de
  "bestell\\p{L}*", "auftrag\\p{L}*", "rechnung\\p{L}*", "kunden\\p{L}*", "telefon\\p{L}*", "handy", "artikel\\p{L}*",
  "referenz\\p{L}*", "konto\\p{L}*", "plz", "postleitzahl", "ust-?id\\p{L}*", "ust", "mwst", "steuer\\p{L}*", "betrag",
  "preis", "summe", "gutschein\\p{L}*",
  // fr
  "commande", "facture", "client", "t[ée]l[ée]phone", "t[ée]l", "r[ée]f[ée]rence", "tva", "siret", "siren",
  "code postal", "montant", "prix",
  // es / pt / it / nl
  "pedido", "factura", "fatura", "fattura", "cliente", "tel[ée]fono", "telefone", "telefono", "referencia",
  "riferimento", "iva", "nif", "cif", "cnpj", "cpf", "c[óo]digo postal", "importe", "precio", "pre[çc]o", "prezzo",
  "ordine", "bestelling", "ordernummer", "factuur", "klant\\p{L}*", "telefoon", "btw", "postcode", "bedrag", "prijs",
  // pl / cs / sv / no / da / fi / tr
  "zam[óo]wieni\\p{L}*", "faktur\\p{L}*", "klient\\p{L}*", "nip", "objedn[áa]vk\\p{L}*",
  "kund\\p{L}*", "moms", "postnummer", "tilaus\\p{L}*", "lasku\\p{L}*", "puhelin\\p{L}*", "alv", "sipari[şs]\\p{L}*",
  "fatura\\p{L}*", "vergi\\p{L}*",
  // ja / zh / ko / ar
  "注文", "電話", "电话", "订单", "訂單", "发票", "주문", "전화", "طلب", "هاتف", "فاتورة",
]);

/** Words that mean a nearby phone-length number is a phone number. */
export const PHONE_WORD_RE = labelRegex([
  "call", "phone", "tel", "telephone", "fax", "mobile", "cell", "sms", "dial", "hotline", "toll[\\s-]?free", "whatsapp",
  "telefon\\p{L}*", "handy", "t[ée]l[ée]phone", "t[ée]l", "tel[ée]fono", "telefone", "telefono", "telefoon", "puhelin\\p{L}*",
  "電話", "电话", "전화", "هاتف",
]);

/** End offset of the last match of `re` (a global regex) in `text`, or -1. */
export function lastMatchEnd(re: RegExp, text: string): number {
  let last = -1;
  for (const m of text.matchAll(re)) last = (m.index ?? 0) + m[0].length;
  return last;
}
