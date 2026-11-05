const ITEMS = [
  {
    n: '01',
    t: 'Boutique 100 % en ligne',
    d: 'HYPE est une boutique exclusivement en ligne. Nous n’avons pas de magasin physique : toutes les commandes se passent sur ce site.',
  },
  {
    n: '02',
    t: 'Zone de livraison',
    d: 'Nous livrons uniquement à Antananarivo et dans sa périphérie.',
  },
  {
    n: '03',
    t: 'Frais de livraison',
    d: 'À partir de 3 000 Ar dans Antananarivo et 4 000 Ar en périphérie.',
  },
  {
    n: '04',
    t: 'Délai de livraison',
    d: 'Votre colis arrive en 7 à 15 jours à partir de la confirmation de votre commande.',
  },
  {
    n: '05',
    t: 'Acompte obligatoire',
    d: 'Votre commande n’est confirmée qu’après paiement par Mvola : soit un acompte de 50 % avec le reste à payer à la livraison, soit le paiement complet à l’avance.',
  },
  {
    n: '06',
    t: 'Confirmation sur WhatsApp',
    d: 'Le numéro de téléphone indiqué doit être joignable sur WhatsApp. C’est par ce moyen que nous confirmons et validons votre commande.',
  },
  {
    n: '07',
    t: 'Articles neufs et importés',
    d: 'Tous nos articles sont neufs et importés, sélectionnés pour leur qualité.',
  },
  {
    n: '08',
    t: 'Ni échange ni retour',
    d: 'Les articles ne sont ni échangés ni repris. Vérifiez bien la taille, la couleur et l’adresse avant de valider votre commande.',
  },
];

export function ConditionsDeVente() {
  return (
    <section id="cgv" className="wrap py-4 sm:py-6 px-3 sm:px-4">
      <h2 className="text-xl sm:text-2xl font-normal uppercase font-['Anton',sans-serif] tracking-wide border-b-2 border-[var(--red)] pb-0.5 mb-1 inline-block">
        Conditions de vente
      </h2>
      <p className="text-xs sm:text-sm text-[var(--mut)] mb-4">
        À lire avant de commander. Passer une commande signifie que vous acceptez ces conditions.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {ITEMS.map((it) => (
          <div
            key={it.n}
            className="flex gap-3 p-3 sm:p-4 bg-[var(--card)] border border-[var(--ln)] border-l-4 border-l-[var(--red)] rounded-md"
          >
            <span className="font-['Anton',sans-serif] text-2xl leading-none text-[var(--red)] shrink-0">
              {it.n}
            </span>
            <div>
              <h3 className="text-sm sm:text-base tracking-wide">{it.t}</h3>
              <p className="text-xs sm:text-sm text-[var(--mut)] mt-1 leading-relaxed">{it.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
