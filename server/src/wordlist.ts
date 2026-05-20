/**
 * wordlist.ts
 *
 * A curated set of common, unambiguous English words used to generate
 * human-readable 3-word share phrases (e.g., "blue-sky-rocket").
 *
 * Words are intentionally short (3-6 chars), phonetically distinct,
 * and easy to read aloud or type manually.
 */

export const WORD_LIST: readonly string[] = [
  "apple", "arrow", "atlas", "azure",
  "baker", "baron", "blade", "blaze", "bloom", "bluff", "boost", "brave",
  "bravo", "brick", "brief", "brisk", "brook", "brush", "brute",
  "cabin", "cable", "cairn", "calm", "cargo", "cedar", "chain", "chalk",
  "chase", "chief", "chill", "chord", "civic", "clamp", "clash", "clean",
  "clear", "clerk", "cliff", "clock", "clone", "close", "cloud", "clove",
  "coast", "cobra", "comet", "coral", "crane", "creek", "crisp", "cross",
  "crown", "crush", "crypt", "cubic", "cycle",
  "dagger", "dawn", "delta", "depot", "derby", "dirge", "disco", "dodge",
  "dome", "donor", "draft", "drain", "drank", "drift", "drive", "drone",
  "druid", "dunes", "dunno",
  "eagle", "earth", "easel", "eight", "elite", "ember", "epoch", "ethic",
  "event", "exact", "excel", "exile", "extra",
  "fable", "facet", "faith", "false", "fancy", "feast", "fence", "ferry",
  "fetch", "field", "fifth", "fifty", "fight", "final", "first", "fixed",
  "fjord", "flame", "flank", "flask", "fleet", "flesh", "flick", "flinch",
  "float", "flood", "floor", "flora", "flour", "flown", "fluid", "flute",
  "focal", "foggy", "foray", "forge", "forth", "found", "frank", "fresh",
  "friar", "front", "frost", "froze", "fudge", "fugue",
  "gains", "gamma", "gauze", "gavel", "gecko", "ghost", "girth", "given",
  "glade", "gland", "glare", "glass", "glint", "globe", "gloom", "gloss",
  "glyph", "gnome", "grace", "grade", "grant", "graph", "grasp", "grass",
  "graze", "greed", "green", "greet", "grief", "grind", "groan", "grove",
  "growl", "gruel", "gruff", "grunge", "guest", "guide", "guild", "guile",
  "guise", "gusto",
  "hazel", "heist", "helix", "herald", "holly", "honor", "humid",
  "inert", "inlet", "ivory",
  "jewel", "joust", "judge",
  "karma", "ketch", "knack", "knave", "kneel", "knelt", "knife", "knoll",
  "lance", "latch", "layer", "ledge", "lemma", "level", "light", "lilac",
  "links", "local", "lodge", "logic", "lunar",
  "maple", "march", "marsh", "match", "merit", "metal", "minor", "mirch",
  "mirth", "model", "moose", "moral", "morse", "motif", "mount", "mouse",
  "mulch", "music",
  "nerve", "nexus", "night", "noble", "north", "notch", "novel", "nudge",
  "ocean", "olive", "onset", "optic", "orbit", "order", "outer", "outwit",
  "oxide",
  "paint", "parch", "parse", "patch", "pause", "pearl", "pedal", "perch",
  "phase", "pilot", "pinch", "pixel", "pivot", "pixel", "place", "plaid",
  "plain", "plait", "plank", "plant", "plaza", "plumb", "plume", "plunk",
  "plush", "polar", "pouch", "power", "press", "pride", "prime", "prior",
  "prism", "probe", "prone", "proof", "prose", "proud", "proxy", "pulse",
  "punch", "purge",
  "quark", "quell", "quest", "queue", "quick", "quiet", "quirk", "quota",
  "quote",
  "radar", "radix", "rally", "ranch", "rapid", "ratio", "reach", "realm",
  "rebel", "recon", "redux", "relay", "remix", "revel", "rider", "ridge",
  "rivet", "rogue", "roman", "rondo", "rover", "royal", "rugby", "ruled",
  "rumor", "rune",
  "safari", "salvo", "sandy", "sauce", "scout", "scythe", "sedan", "servo",
  "seven", "shaft", "shale", "shame", "share", "sharp", "shear", "shell",
  "shift", "shore", "short", "shout", "sigma", "sight", "sixth", "sixty",
  "skate", "sketch", "skill", "skull", "slate", "sleek", "sleet", "slick",
  "slide", "slime", "slope", "smart", "smelt", "smite", "smoke", "snare",
  "snipe", "solar", "solid", "sonar", "sonic", "space", "spark", "spawn",
  "spear", "speck", "spell", "spend", "spice", "spike", "spine", "spirit",
  "split", "spoke", "spore", "sport", "spout", "spray", "spree", "sprig",
  "spunk", "squad", "squid", "stack", "staff", "stage", "stain", "stalk",
  "stall", "stamp", "stark", "start", "stash", "state", "stead", "steel",
  "steep", "steer", "stern", "stick", "stiff", "still", "sting", "stock",
  "stoic", "stone", "storm", "story", "stout", "stove", "strap", "straw",
  "stray", "strewn", "strip", "strobe", "strove", "strung", "stuck",
  "study", "stump", "stung", "stunt", "style", "surge", "swamp", "swarm",
  "swath", "swift", "swipe", "swirl", "sword",
  "table", "talon", "tango", "tasty", "taunt", "tempo", "tense", "tenth",
  "tepid", "terra", "terse", "theme", "third", "thorn", "three", "throw",
  "thrum", "tidal", "tiger", "tight", "timer", "title", "token", "tonic",
  "torch", "total", "tough", "tower", "toxic", "track", "trade", "trail",
  "train", "trait", "tramp", "trend", "trial", "triad", "tribe", "trick",
  "tried", "troop", "troth", "trove", "truce", "trunk", "truss", "trust",
  "truth", "tuber", "tulip", "tuner", "turbo", "tutor",
  "ultra", "unify", "unity", "upper", "urban", "usher",
  "valid", "valor", "valve", "vapid", "vault", "venom", "venue", "verge",
  "verse", "vigor", "viral", "visor", "vista", "vital", "vivid", "vocal",
  "vogue", "voice", "voila", "voter",
  "wager", "watch", "water", "weave", "wedge", "wharf", "wheat", "wheel",
  "which", "while", "white", "whole", "wider", "wield", "winch", "witch",
  "women", "world", "worse", "worth", "would", "wrath",
  "yield",
  "zebra", "zonal", "zones",
] as const;

/**
 * Generates a random 3-word hyphen-separated phrase from WORD_LIST.
 * With ~350 words the phrase space is 350^3 ≈ 42.8 million combinations —
 * more than sufficient for ephemeral short-lived tokens.
 */
export function generatePhrase(): string {
  const pick = (): string =>
    WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)] as string;

  return `${pick()}-${pick()}-${pick()}`;
}
