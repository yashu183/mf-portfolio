// The fund house behind a scheme, read from its name, and the logo kept for it in public/amc.
// A house with no logo here (or one that fails to load) shows the fund's initials instead.
const HOUSES = [
  [/aditya birla|\babsl\b/i, 'absl'],
  [/\bhdfc\b/i, 'hdfc'],
  [/\bicici\b/i, 'icici'],
  [/\bnippon\b/i, 'nippon'],
  [/\bbandhan\b/i, 'bandhan'],
  [/\bparag\b|\bppfas\b/i, 'ppfas'],
  [/\baxis\b/i, 'axis'],
  [/\bkotak\b/i, 'kotak'],
  [/\bmirae\b/i, 'mirae'],
];

// logos drawn edge to edge on their own coloured square: they fill the round tile instead of sitting on white
const FULL_BLEED = new Set(['absl', 'mirae']);

export const amcLogo = (fund) => {
  const text = `${fund?.name ?? ''} ${fund?.shortName ?? ''}`;
  const hit = HOUSES.find(([re]) => re.test(text));
  return hit ? { src: `${import.meta.env.BASE_URL}amc/${hit[1]}.png`, fill: FULL_BLEED.has(hit[1]) } : null;
};
