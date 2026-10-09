let clicks = 0
document.querySelector('#counter').addEventListener('click', () => {
  clicks += 1
  document.querySelector('#result').textContent = `JavaScript works. Button clicked ${clicks} ${clicks === 1 ? 'time' : 'times'}.`
})
