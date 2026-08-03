export const NOVA_JOKES = [
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "Why can't a leopard hide? Because he's always spotted.",
  "What do you call a fish without eyes? A fsh.",
  "Why did the math book look so sad? It had too many problems.",
  "What do you call a sleeping dinosaur? A dino-snore.",
  "Why do cows wear bells? Because their horns don't work.",
  "What do elves learn in school? The elf-abet.",
  "Why did the bicycle fall over? It was two-tired.",
  "What do you call a fake noodle? An impasta.",
  "Why did the golfer bring extra pants? In case he got a hole in one.",
  "What do you call a dog that does magic? A labracadabrador.",
  "Why don't scientists trust atoms? Because they make up everything.",
  "What do you call a bear with no teeth? A gummy bear.",
  "Why did the stadium get hot after the game? All the fans left.",
  "What did the ocean say to the beach? Nothing, it just waved.",
]

export function pickDailyIndex(arr, offset = 0) {
  const day = new Date().toDateString()
  let hash = 0
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) % arr.length
  return ((hash + offset) % arr.length + arr.length) % arr.length
}
