import React from 'react';
import './App.css';

import {Treebeard} from 'react-treebeard'
import Fraction from 'fraction.js'
import TreebeardTheme from "./TreebeardTheme.js";
import RecipeCalculator from "./RecipeCalculator.js"

const Fragment = React.Fragment


class App extends React.Component {
  state = {
    calculator: null,
    loadError: null,
  }

  componentDidMount() {
    fetch('roidata/exports.json')
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
        <CalculatorRoot calculator={this.state.calculator}/>
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
    this.state = this._recompute({}, 'BerryPie', Fraction(8, 15))
  }

  _recompute(target, product, qty_per_day) {
    const buildTree = this.props.calculator.buildTree(product, qty_per_day)
    const totals = this.props.calculator.totals(buildTree)
    const grandTotal = Object.values(totals).map(t => t.totalFactoryCost).reduce((a, b) => a + b, 0)
    return Object.assign(target, {
      recipe: product,
      requiredQty: qty_per_day,
      tree: buildTree,
      treebeardTree: this.toTreebeardTree(buildTree),
      totals: totals,
      treebeardTotals: this.toTreebeardTotals(totals, grandTotal),
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
        <Treebeard data={this.state.treebeardTree} onToggle={this.onBuildTreeToggle} style={TreebeardTheme} />
        <h4>Totals</h4>
        <Treebeard data={this.state.treebeardTotals} onToggle={this.onTotalsTreeToggle} style={TreebeardTheme} />
        <p className='timestamp'>Data harvested on {this.props.calculator.dataTimestamp}</p>
      </div>)
  }

  onInputChange(state) {
    this.setState((prevState) => {
      const newState = Object.assign({}, prevState, state)
      return this._recompute(state, newState.recipe, newState.requiredQty)
    })
  }

  toTreebeardTree(node, level=0) {
    return {
      name: this._recipeHeader(node.output, node.recipeQty, node.factory, 'pn'+level),
      toggled: true,
      children: node.inputs.map(i => this.toTreebeardTree(i, level + 1))
    }
  }

  toTreebeardTotals(totals, grandTotal) {
    const r = Object.entries(totals).map(entry => {
      const output = entry[0]
      const totals = entry[1]
      return {
        name: (<Fragment>{this._recipeHeader(output, totals.total, totals.factory)}{this._renderCosts(totals)}</Fragment>),
        toggled: true,
        children: totals.towards.length <= 1 ? [] : totals.towards.map(t => Object.assign({
          name: (<Fragment>{t.recipe} {pf(t.recipeQty)} ({pf(t.fraction)} of all)</Fragment>),
          toggled: false,
          children: null,
        }))
      }
    });
    r.push({
      name: (<Fragment>
        <span className="totalHeader">Total excluding hubs</span>
        <span className="totalCost">{pc(grandTotal)}</span>
        </Fragment>),
      toggled: true,
      children: []
    })
    return r
  }

  _recipeHeader(output, recipeQty, factory, extraClassName='') {
    return (<Fragment>
      <span className={"productName " + extraClassName}>{output}</span>
      <span className="recipeQty">{pf(recipeQty)}</span>
      <span className="factory">{factory}</span>
      </Fragment>)
  }

  _renderCosts(totals) {
    return (<Fragment>
      <span className="recipeQtyRoundUp">{totals.roundFactoryCount}</span>
      &nbsp;x&nbsp;
      <span className="singleFactoryCost">{pc(totals.singleFactoryCost)}</span>
      &nbsp;=&nbsp;
      <span className="totalCost">{pc(totals.totalFactoryCost)}</span>
      </Fragment>)
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
    const n = 15 * this.state.requiredQty.n / this.state.requiredQty.d
    return (
      <form>
        Recipe: 
        <select onChange={this.onRecipeChanged} value={this.state.recipe}>
          {this.renderOptions()}
        </select>
        &nbsp;
        Required quantity:&nbsp;
        <input type='text' onChange={this.onQtyChanged} value={n} />
        &nbsp;per 15 days
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
  const _render_proper_fraction = (n, d) => (<Fragment><sup>{n}</sup>&frasl;<sub>{d}</sub></Fragment>)
  if (f === null || f === undefined) return '<NOOO>'
  if (f.n === 0) return '0'
  // return f.n.toString() + "/" + f.d.toString()
  let i = Math.floor(f.n / f.d)
  let r = f.n % f.d
  return (<Fragment>{i === 0 ? '' : i}{r === 0 ? '' : _render_proper_fraction(f.n - f.d * i, f.d)}</Fragment>)
}

function pc(c) {
  return "$" + c;
}

export default App;
