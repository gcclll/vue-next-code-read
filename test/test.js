let dummy

const counter = {
  num: 0
}

let ob
function update() {
  // ob.num = ob.num + 1
  dummy = ob.num++
  console.log({ dummy }, ob)
}

ob = new Proxy(counter, {
  set(target, key, value, receiver) {
    const res = Reflect.set(...arguments)
    update()
    return res
  },
  get(target, key, receiver) {
    return Reflect.get(...arguments)
  }
})

ob.num = 2
