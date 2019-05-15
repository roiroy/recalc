import React from 'react';
import PropTypes from 'prop-types';
import {Treebeard} from 'react-treebeard'

const InvisibleContainer = () => null

class RecipeContainer extends Treebeard.defaultProps.decorators.Container {
    renderEmptyToggle() {
        return (<div style={this.props.style.toggle.base} className="emptyToggle">◼&nbsp;</div>)
    }

    render() {
        const {style, decorators, onClick, node} = this.props;
        return (
            <div
                onClick={onClick}
                style={node.active ? {...style.container} : {...style.link}}>
                {node.children === null ? null : 
                    (node.children.length === 0 ? this.renderEmptyToggle() : this.renderToggle()) }
                <decorators.Header node={node} style={style.header}/>
            </div>
        );
    }
}

RecipeContainer.propTypes = {
    style: PropTypes.object.isRequired,
    decorators: PropTypes.object.isRequired,
    terminal: PropTypes.bool.isRequired,
    onClick: PropTypes.func.isRequired,
    animations: PropTypes.oneOfType([
        PropTypes.object,
        PropTypes.bool
    ]).isRequired,
    node: PropTypes.object.isRequired
};


const _copyDefaultDecorators= (o => Object.assign({}, Treebeard.defaultProps.decorators, o))
var recipeDecorators = _copyDefaultDecorators({ Container: RecipeContainer })
var emptyContainerDecorators = _copyDefaultDecorators({ Container: InvisibleContainer })

export {
    recipeDecorators,
    emptyContainerDecorators,
}
