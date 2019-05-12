import Fraction from 'fraction.js'

class BuildTreeNode {
  constructor(recipe, output, recipeQty, inputs, factory) {
    this.recipe = recipe
    this.output = output
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

  buildTree(product, qty_per_day) {
    // console.log("PRODUCT", product, qty_per_day)
    let productRecipe = this.outputToRecipe[product]
    let outputQtyPerDay = this.outputQtyPerDay(productRecipe, product)
    let recipeQty = qty_per_day.div(outputQtyPerDay)
    let input_qty = (inputCount) => recipeQty.mul(Fraction(inputCount, Math.floor(productRecipe.days)))
    return new BuildTreeNode(productRecipe.name, product, recipeQty, 
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
    return t
  }

  _addTotalFractionsAndCost(root, totals) {
    const traverse = (node) => {
      for (let input of node.inputs) {
        const inTotal = totals[input.output]
        inTotal.towards.push({
          recipe: node.recipe,
          product: node.product,
          recipeQty: input.recipeQty,
          fraction: input.recipeQty.div(totals[input.output].total)
        })
        traverse(input)
      }
    }
    traverse(root)
    for (let [product, total] of Object.entries(totals)) {
      const building = this.recipeToBuilding[this.outputToRecipe[product].name]
      total.factory = building.name
      total.singleFactoryCost = building.harvesterCost ? building.harvesterCost : building.cost
      total.isHarvester = !!building.harvesterCost
      total.roundFactoryCount = Math.ceil(total.total.valueOf())
      total.totalFactoryCost = total.roundFactoryCount * total.singleFactoryCost
    }
  }
}

export default RecipeCalculator
