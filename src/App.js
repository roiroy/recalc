import React from 'react';
import './App.css';

import {Treebeard} from 'react-treebeard'
import Fraction from 'fraction.js'


class App extends React.Component {
  state = {
    calculator: null,
    loadError: null,
  }

  componentDidMount() {
    fetch('exports.json')
      .then(response => response.json())
      .then(data => new RecipeCalculator(data))
      .then(calculator => this.setState({calculator: calculator}) )
      .catch(error => this.setState({loadError: error}))
  }

  render() {
    if (this.state.loadError) {
      return (<p><b>Load error</b> {this.state.loadError.toString()}</p>)
    } else if (this.state.calculator) {
      return (
        <div>
          <h2>Rise of Industry Ratio Calculator</h2>
          <CalculatorRoot calculator={this.state.calculator}/>
        </div>
      )
    } else {
      return (<p>Loading...</p>)
    }
  }
}

class CalculatorRoot extends React.Component {
  constructor(props) {
    super(props)
    this.onBuildTreeToggle = this.onBuildTreeToggle.bind(this)
    this.onTotalsTreeToggle = this.onTotalsTreeToggle.bind(this)
    this.onInputChange = this.onInputChange.bind(this)
    this.state = this._recompute({}, 'Water', Fraction(10, 15))
  }

  _recompute(target, product, qty_per_day) {
    const buildTree = this.props.calculator.buildTree(product, qty_per_day)
    const totals = this.props.calculator.totals(buildTree)
    return Object.assign(target, {
      recipe: product,
      requiredQty: qty_per_day,
      tree: buildTree,
      treebeardTree: this.toTreebeardTree(buildTree),
      totals: totals,
      treebeardTotals: this.toTreebeardTotals(totals),
    })
  }

  render() {
    const recipes = Object.keys(this.props.calculator.outputToRecipe)
    recipes.sort()
    return (
      <div>
        <h4>What and how much do you desire?</h4>
        <CalculatorInput recipes={recipes}
          recipe={this.state.recipe} requiredQty={this.state.requiredQty} onChange={this.onInputChange} />
        <h4>Build tree</h4>
        <Treebeard data={this.state.treebeardTree} onToggle={this.onBuildTreeToggle} />
        <h4>Totals</h4>
        <Treebeard data={this.state.treebeardTotals} onToggle={this.onTotalsTreeToggle} />
      </div>)
  }

  onInputChange(state) {
    this.setState((prevState) => {
      const newState = Object.assign({}, prevState, state)
      return this._recompute(state, newState.recipe, newState.requiredQty)
    })
  }

  toTreebeardTree(node) {
    return {
      name: node.output + " " + pf(node.recipeQty),
      toggled: true,
      children: node.inputs.map(i => this.toTreebeardTree(i))
    }
  }

  toTreebeardTotals(totals) {
    const r = Object.entries(totals).map(entry => {
      const output = entry[0]
      const totals = entry[1]
      return {
        name: output + " " + pf(totals.total),
        toggled: true,
        children: totals.towards.length <= 1 ? [] : totals.towards.map(t => Object.assign({
          name: t.recipe + " " + pf(t.recipeQty) + " (" + pf(t.fraction) + " of all)",
          toggled: false,
          children: [],
        }))
      }
    });
    return r
  }

  _onTreeToggle(node, toggled, treeName, cursorName) {
    const cursor = this.state[cursorName]
    const tree = this.state[treeName]
    if (cursor) {
      cursor.active = false;
    }
    node.active = true;
    if (node.children) { 
        node.toggled = toggled; 
    }
    this.setState(() => ({
      [cursorName]: node, 
      [treeName]: Object.assign({}, tree)
    }));
  }

  onBuildTreeToggle(node, toggled) {
    this._onTreeToggle(node, toggled, 'treebeardTree', 'buildCursor')
    // const {treebeardTree, buildCursor} = this.state;
    // if (buildCursor) {
    //   buildCursor.active = false;
    // }
    // node.active = true;
    // if (node.children) { 
    //     node.toggled = toggled; 
    // }
    // this.setState(() => ({buildCursor: node, treebeardTree: Object.assign({}, treebeardTree)}));
  }

  onTotalsTreeToggle(node, toggled) {
    // TODO: why you no work?
    // this._onTreeToggle(node, toggled, 'treebeardTotals', 'totalsCursor')
  }
}

class CalculatorInput extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      recipe: props.recipe,
      requiredQty: props.requiredQty,
    }
    this.onRecipeChanged = this.onRecipeChanged.bind(this)
    this.onQtyChanged = this.onQtyChanged.bind(this)
  }

  render() {
    // TODO: the quantity will be wrong if this.state.requiredQty doesn't have d=15
    const n = 15 * this.state.requiredQty.n / this.state.requiredQty.d
    return (
      <form>
        Recipe: 
        <select onChange={this.onRecipeChanged} value={this.state.recipe}>
          {this.renderOptions()}
        </select>
        &nbsp;
        Required quantity: 
        <input type='text' onChange={this.onQtyChanged} value={n} />
        per 15 days
      </form>
    )
  }

  renderOptions() {
    return this.props.recipes.map(recipe => (
      <option key={recipe} value={recipe}>{recipe}</option>
    ))
  }

  onRecipeChanged(event) {
    const state = { recipe: event.target.value }
    this.setState(() => state)
    this.props.onChange(state)
  }

  onQtyChanged(event) {
    const intVal = parseFloat(event.target.value)
    if (isNaN(intVal)) return
    const state = { requiredQty: Fraction(intVal, 15) }
    this.setState(() => state)
    this.props.onChange(state)
  }
}

function pf(f) {
  if (f === null || f === undefined) return '<NOOO>'
  // return f.n.toString() + "/" + f.d.toString()
  let i = Math.floor(f.n / f.d)
  let r = f.n % f.d
  let parts = []
  if (i !== 0) parts.push(i.toString())
  if (r !== 0) parts.push((f.n - f.d * i).toString() + '/' + f.d)
  return parts.join('+') || '0'
}

class BuildTreeNode {
  constructor(output, recipeQty, inputs) {
    this.output = output
    this.recipeQty = recipeQty
    this.inputs = inputs
  }
}

class RecipeCalculator {
  constructor(rawData) {
    this.recipeToBuilding = this.mapRecipesToBuildings(rawData.producers)
    this.outputToRecipe = this.mapOutputs(rawData.recipes)
  }

  mapRecipesToBuildings(producers) {
    let r = {}
    for (let p of producers) {
      for (let recipe of p.recipes) {
        r[recipe] = p.name
      }
    }
    return r
  }

  mapOutputs(recipes) {
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
    return new BuildTreeNode(product, recipeQty, productRecipe.inputs.map(input => 
      this.buildTree(input.name, input_qty(input.amount))))
  }

  totals(root) {
    const t = this._totals(root)
    this.addFractions(root, t)
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

  addFractions(root, totals) {
    const traverse = (node) => {
      for (let input of node.inputs) {
        const inTotal = totals[input.output]
        inTotal.towards.push({
          recipe: node.output,
          recipeQty: input.recipeQty,
          fraction: input.recipeQty.div(totals[input.output].total)
        })
        traverse(input)
      }
    }
    return traverse(root)
  }
}

export default App;
