const adjectives = [
  "majestic",
  "fierce",
  "cuddly",
  "graceful",
  "working",
  "sleek",
  "wild",
  "sly",
  "persistent",
  "regal",
  "elegant",
  "patient",
  "dignified",
  "intelligent",
  "curious",
  "swift",
  "mighty",
  "commanding",
  "soaring"
];

const animals = [ 
  "lynx",
  "wolf",
  "bear",
  "bison",
  "deer",
  "beaver",
  "polecat",
  "boar",
  "elk",
  "fox",
  "badger",
  "eagle",
  "stork",
  "crane",
  "heron",
  "cormorant",
  "swan",
  "raven",
  "magpie",
  "buzzard",
  "kite",
  "eagle",
  "stork",
  "osprey",
  "eagle",
  "kestrel"
];

function pick(a) {
  return a[Math.floor(Math.random()*a.length)];   
}

function load_name() {
    return pick(adjectives) + "_" + pick(animals) + "_" + Math.floor(2023*Math.random())
}

document.getElementById('inbox').placeholder = load_name()

function go_to_inbox() {
  const inbox = document.getElementById('inbox');
  window.location.href= './inbox.html?user=' + (inbox.value || inbox.placeholder)
}

document.getElementById('inbox_button').onclick = go_to_inbox;
