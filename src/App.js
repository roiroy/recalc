import React from 'react';
import './App.css';

import {Treebeard} from 'react-treebeard'
import Fraction from 'fraction.js'
import TreebeardTheme from "./TreebeardTheme.js";
import RecipeCalculator from "./RecipeCalculator.js"
import { recipeDecorators, emptyContainerDecorators } from "./TreebeardDecorators.js"

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
    this.onSettingsChange = this.onSettingsChange.bind(this)
    this.pf = this.pf.bind(this)
    this.state = {
      settings: {
        numbers: 'fractions',
        perDays: 15,
      }
    }
    this.state = this._recompute(this.state, [{recipe: 'ChickenMeat', requiredN: 11}])
  }

  _recompute(target, requiredProducts) {
    const requirements = requiredProducts
        .filter(req => req.requiredN > 0)
        .map(({recipe, requiredN}) => ({recipe, qtyPerDay: Fraction(requiredN, this.state.settings.perDays)}))
    const buildTree = this.props.calculator.buildTreeFromMany(requirements)
    const totals = this.props.calculator.totals(buildTree)
    const grandTotal = Object.values(totals).map(t => t.totalFactoryCost).reduce((a, b) => a + b, 0)
    const calculationState = {
      required: requiredProducts,
      tree: buildTree,
      totals: totals,
      grandTotal: grandTotal,
      treebeardTree: this.toTreebeardTree(buildTree),
      treebeardTotals: this.toTreebeardTotals(totals, grandTotal),
    }
    return Object.assign(target, calculationState)
  }

  onSettingsChange(newSettings) {
    this.setState((prevState) => ({ settings: Object.assign(prevState.settings, newSettings) }))
    // double update but meh
    this.setState((prevState) => this._recompute({}, [{recipe: prevState.recipe, requiredN: prevState.requiredN}]))
  }

  render() {
    const recipes = Object.keys(this.props.calculator.outputToRecipe)
    recipes.sort()
    return (
      <div>
        <h4>What and how much do you desire?</h4>
        <CalculatorInput required={this.state.required} recipes={recipes} perDays={this.state.settings.perDays} onChange={this.onInputChange} />
        <CalculatorSettings settings={this.state.settings} onChange={this.onSettingsChange} />
        <h4>Totals</h4>
        {this.totalsTreeHeader()}
        <Treebeard data={this.state.treebeardTotals} onToggle={this.onTotalsTreeToggle} style={TreebeardTheme} />
        <h4>Build tree</h4>
        {this.buildTreeHeader()}
        <Treebeard data={this.state.treebeardTree} onToggle={this.onBuildTreeToggle} style={TreebeardTheme} />
        <p className='timestamp'>Data harvested on {this.props.calculator.dataTimestamp}</p>
      </div>)
  }

  buildTreeHeader() {
    return (
      <div id='buildTreeHeader' className='treeHeader'>
        <div className='filler'>&nbsp;</div>
        {this.recipeHeader()}
      </div>
    )
  }

  recipeHeader() {
    return (
      <Fragment>
        <span className="productName header">Product</span>
        <span className="demand header tooltipHolder">Demand<span className='tooltipText'>per {this.state.settings.perDays} days</span></span>
        <span className="recipeQty header tooltipHolder">x<span className="tooltipText">number of factories</span></span>
        <span className="factory header">Factory Building</span>
      </Fragment>
    )
  }

  totalsTreeHeader() {
    return (
      <div id='totalsHeader' className='treeHeader'>
        <div className='filler'>&nbsp;</div>
        {this.recipeHeader()}
        <span className="recipeQtyRoundUp header tooltipHolder">⌈x⌉<span className="tooltipText">number of factories rounded up</span></span>
        <span className="header">&nbsp;x&nbsp;</span>
        <span className="singleFactoryCost header tooltipHolder">Cost<span className="tooltipText">single factory or field cost</span></span>
        <span className="header">&nbsp;=&nbsp;</span>
        <span className="totalCost header">Total</span>
      </div>
    )
  }

  onInputChange(required) {
    this.setState((prevState) => this._recompute(prevState, required))
  }

  toTreebeardTree(node, level=0) {
    return {
      name: level === 0 ? null : this._recipeHeader(node.output, node.demandPerDay, node.recipeQty, node.factory, 'pn'+(level-1)),
      toggled: true,
      children: node.inputs.map(i => this.toTreebeardTree(i, level + 1)),
      decorators: level === 0 ? emptyContainerDecorators : recipeDecorators,
    }
  }

  toTreebeardTotals(totals, grandTotal) {
    const r = Object.entries(totals).map(([output, totals]) => ({
        name: (<Fragment>{this._recipeHeader(output, totals.demandPerDay, totals.total, totals.factory)}{this._renderCosts(totals)}</Fragment>),
        toggled: false,
        children: totals.towards.length <= 1 ? [] : totals.towards.filter(t => t.recipe !== '').map(t => Object.assign({
          name: (<Fragment>{t.fraction.valueOf() === 1.0 ? 'all' : this.pf(t.fraction)} towards {t.recipe} ({this.pf(t.recipeQty)} buildings)</Fragment>),
          toggled: false,
          children: null,
        })),
        decorators: recipeDecorators,
    }))
    return {
      name: (<Fragment>
        <span className="totalHeader">Total excluding hubs</span>
        <span className="totalCost">{pc(grandTotal)}</span>
        </Fragment>),
      toggled: true,
      children: r,
    }
  }

  _recipeHeader(output, demandPerDay, recipeQty, factory, extraClassName='') {
    return output === '' ? null : (<Fragment>
      <span className={"productName " + extraClassName}>{output}</span>
      <span className="demand">{this.pf(demandPerDay.mul(this.state.settings.perDays))}</span>
      <span className="recipeQty">{this.pf(recipeQty)}</span>
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
    this._onTreeToggle(node, toggled, 'treebeardTotals', 'totalsCursor')
  }

  pf(f) {
    return pf(f, this.state.settings.numbers)
  }
}

class CalculatorInput extends React.Component {
  constructor(props) {
    super(props)
    this.onChange = this.onChange.bind(this)
    this.onAddAnotherClick = this.onAddAnotherClick.bind(this)
    this.onRemoveRow = this.onRemoveRow.bind(this)
  }

  render() {
    return (
      <ul id='calculatorInput'>
        {this.props.required.map((req, index) => (
          <li>
            <CalculatorInputRow key={index} recipes={this.props.recipes} recipe={req.recipe} 
                requiredN={req.requiredN} perDays={this.props.perDays} onChange={(e) => this.onChange(index, e)} />
            &nbsp;<a className='close' onClick={(e) => this.onRemoveRow(index)}>[x]</a>
          </li>
        ))}
        <li><a onClick={this.onAddAnotherClick}>add another recipe</a></li>
      </ul>
      )
  }

  onRemoveRow(index) {
    var newRequired = [...this.props.required]
    newRequired.splice(index, 1)
    if (newRequired.length === 0) {
      newRequired = [this._newRecipe()]
    }
    this.props.onChange(newRequired)
  }

  onAddAnotherClick() {
    const newRequired = this.props.required.concat([this._newRecipe()])
    this.props.onChange(newRequired)
  }

  _newRecipe() {
    return {recipe: 'Water', requiredN: 1}
  }

  onChange(index, changedRequirement) {
    var newRequired = [...this.props.required]
    console.log(changedRequirement, index, newRequired)
    Object.assign(newRequired[index], changedRequirement)
    this.props.onChange(newRequired)
  }
}

class CalculatorInputRow extends React.Component {
  constructor(props) {
    super(props)
    this.onRecipeChanged = this.onRecipeChanged.bind(this)
    this.onQtyChanged = this.onQtyChanged.bind(this)
  }

  render() {
    return (
      <Fragment>
        Recipe: 
        <select onChange={this.onRecipeChanged} value={this.props.recipe}>
          {this._renderRecipeOptions()}
        </select>
        &nbsp;
        Required quantity:&nbsp;
        <input type='number' onChange={this.onQtyChanged} value={this.props.requiredN} />
        &nbsp;per {this.props.perDays} days
      </Fragment>
    )
  }

  _renderRecipeOptions() {
    return this.props.recipes.map(recipe => (
      <option key={recipe} value={recipe}>{recipe}</option>
    ))
  }

  onRecipeChanged(event) {
    this.props.onChange({ recipe: event.target.value })
  }

  onQtyChanged(event) {
    const intVal = parseFloat(event.target.value)
    if (isNaN(intVal)) return
    this.props.onChange({requiredN: intVal})
  }
}


class CalculatorSettings extends React.Component {
  constructor(props) {
    super(props)
    this.onChange = this.onChange.bind(this)
  }

  onChange(e) {
    const { name, value } = e.target;
    this.props.onChange({[name]: value})
  }

  render() {
    return (
      <div id='settings'>
        <p>
          <label for='perDays'>Per </label><input id='perDays' type='number' name='perDays' value={this.props.settings.perDays} onChange={this.onChange}/>
          <label for='perDays'> days </label> (required quantity and demand will be shown per this many days)
        </p>
        <p>
          <label for='fractions'>Fractions</label>
          <input id='fractions' type='radio' name='numbers' value='fractions' checked={this.props.settings.numbers === 'fractions'} onChange={this.onChange}/>
          &nbsp;&nbsp;&nbsp;&nbsp;
          <label for='decimals'>Decimals</label>
          <input id='decimals' type='radio' name='numbers' value='decimals' checked={this.props.settings.numbers === 'decimals'} onChange={this.onChange}/>
        </p>
      </div>
    )
  }
}


function pf(f, format='fractions') {
  if (f === null || f === undefined) return '<NOOO>'
  if (f.n === 0) return '0'
  if (format !== 'fractions') {
    return f.valueOf().toFixed(2)
  }
  const _render_proper_fraction = (n, d) => (<Fragment><sup>{n}</sup>&frasl;<sub>{d}</sub></Fragment>)
  let i = Math.floor(f.n / f.d)
  let r = f.n % f.d
  return (<Fragment>{i === 0 ? '' : i}{r === 0 ? '' : _render_proper_fraction(r, f.d)}</Fragment>)
}

function pc(c) {
  return "$" + c;
}

export default App;
