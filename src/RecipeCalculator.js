import Fraction from 'fraction.js'

class BuildTreeNode {
  constructor(recipe, output, demandPerDay, recipeQty, inputs, factory) {
    this.recipe = recipe
    this.output = output
    this.demandPerDay = demandPerDay
    this.recipeQty = recipeQty
    this.inputs = inputs
    this.factory = factory
  }
}

class RecipeCalculator {
  constructor(rawData) {
    this.recipeToBuilding = this._mapRecipesToBuildings(rawData.producers)
    this.outputToRecipe = this._mapOutputs(rawData.recipes)
    this.dataTimestamp = rawData.timestamp

    this.recipeToBuilding[''] = {} // TODO:
  }

  _mapRecipesToBuildings(producers) {
    let r = {}
    for (let p of producers) {
      for (let recipe of p.recipes) {
        r[recipe] = p
      }
    }
    return r
  }

  _mapOutputs(recipes) {
    let r = {}
    for (let recipe of recipes) {
      if (recipe.name === 'WaterWell') continue
      for (let out of recipe.outputs) {
        r[out.name] = recipe
      }
    }
    return r
  }

  outputQtyPerDay(recipe, output) {
    return Fraction(recipe.outputs.find(o => o.name === output).amount, Math.floor(recipe.days))
  }

  buildTreeFromMany(requirements) {
    this.outputToRecipe[''] = {
      days: 1,
      name: '',
      inputs: requirements.map((r) => ({name: r.recipe, amount: r.qtyPerDay})),
      outputs: [{name: '', amount: 1}],
    }
    return this.buildTree('', Fraction(1, 1))
  }

  buildTree(product, qtyPerDay) {
    // console.log("PRODUCT", product, qtyPerDay)
    return this.buildTreeFromRecipe(product, this.outputToRecipe[product], qtyPerDay)
  }

  buildTreeFromRecipe(product, productRecipe, qtyPerDay) {
    let outputQtyPerDay = this.outputQtyPerDay(productRecipe, product)
    let recipeQty = qtyPerDay.div(outputQtyPerDay)
    let input_qty = (inputCount) => recipeQty.mul(inputCount).div(Math.floor(productRecipe.days))
    return new BuildTreeNode(productRecipe.name, product, qtyPerDay, recipeQty, 
      productRecipe.inputs.map(input => this.buildTree(input.name, input_qty(input.amount))),
      this.recipeToBuilding[productRecipe.name].name)
  }

  totals(root) {
    const t = this._totals(root)
    this._addTotalFractionsAndCost(root, t)
    return t
  }

  _totals(node) {
    let newTotal = () => Object.assign({total: Fraction(0), towards: []})

    let addTotals = (target, a) => {
      for (let [recipe, otherTotal] of Object.entries(a)) {
        if (!target.hasOwnProperty(recipe)) target[recipe] = newTotal();
        target[recipe].total = target[recipe].total.add(otherTotal.total)
      }
    }

    let t = {[node.output]: {total: node.recipeQty, towards: []}}
    for (let input of node.inputs) {
      addTotals(t, this.totals(input))
    }
    
    delete t['']
    return t
  }

  _addTotalFractionsAndCost(root, totals) {
    const traverse = (node) => {
      for (let input of node.inputs) {
        const inTotal = totals[input.output]
        inTotal.towards.push({
          recipe: node.recipe,
          recipeQty: input.recipeQty,
          fraction: input.recipeQty.div(totals[input.output].total)
        })
        traverse(input)
      }
    }
    traverse(root)
    for (let [product, total] of Object.entries(totals)) {
      const productRecipe = this.outputToRecipe[product]
      const building = this.recipeToBuilding[productRecipe.name]
      total.factory = building.name
      total.singleFactoryCost = building.harvesterCost ? building.harvesterCost : building.cost
      total.isHarvester = !!building.harvesterCost
      total.roundFactoryCount = Math.ceil(total.total.valueOf())
      total.totalFactoryCost = total.roundFactoryCount * total.singleFactoryCost
      total.demandPerDay = total.total.mul(this.outputQtyPerDay(productRecipe, product))
      total.towards = this._flatten_towards(total.towards)
    }
  }

  _flatten_towards(towards) {
    const m = {}
    for (const t of towards) {
      var c = m[t.recipe]
      if (!c) {
        m[t.recipe] = c = {
          recipe: t.recipe, 
          recipeQty: Fraction(0, 1), 
          fraction: Fraction(0, 1) 
        }
      }
      c.recipeQty = c.recipeQty.add(t.recipeQty)
      c.fraction = c.fraction.add(t.fraction)
    }
    return Object.values(m)
  }
}

export default RecipeCalculator
