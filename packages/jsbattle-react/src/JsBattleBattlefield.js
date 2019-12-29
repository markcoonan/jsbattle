import React from 'react';
import PropTypes from 'prop-types';
import JsBattle from 'jsbattle-engine';

/**
 * For easier integration with [ReactJs](https://reactjs.org/) applications,
 * `jsbattle-react` package contains React component of JsBattle
 * @property {Array} aiDefList - requred. array of AiDefinition objects that describes tanks that fight in the battlefield
 * @property {Number} width - width of battlefield canvas in pixels
 * @property {Number} height - height of battlefield canvas in pixels
 * @property {Number} battlefieldWidth - width of battlefield area
 * @property {Number} battlefieldHeight - height of battlefield area
 * @property {String} renderer - name of renderer to be used
 * @property {Number} rngSeed - rngSeed to be used for the simulation. Random seed will be used if not provided
 * @property {Number} timeLimit - duration of the battle. A battle without limit is started when not defined or set to zero
 * @property {Number} speed - speed multiplier of the battle. For example 2 means that the battle is playes at doubled speed
 * @property {Number} quality - Number between 0 and 1 that define rendering quality (if renderer supports it). String 'auto' can be also provided. In such case, quality will be automatialy adjusted to keep proper performance
 * @property {Boolean} teamMode - whether the battle is played in team mode or not
 * @property {Boolean} autoResize - if true, size of battlefield canvas will be automaticaly adjusted. Otherwise, fixed values from `width` and `height` properties will be used
 * @property {Function} modifier - function applied before the battle that allow changes in the battlefield setup
 * @property {Function} onError - callback for handling errors
 * @property {Function} onInit - callback executed when battlefield is initialized (at the beginning or just after restart)
 * @property {Function} onReady - callback executed when battle is ready to be started (e.g. after loading all assets)
 * @property {Function} onStart - callback executed when battle is started
 * @property {Function} onRender - callback executed on each rendering loop of the battle simulation
 * @property {Function} onFinish - callback executed when battle is finished
 */
class JsBattleBattlefield extends React.Component {

  constructor(props) {
    super(props);
    this.container = React.createRef();
    this.canvas = null;
    this.renderer = null;
    this.onWindowResizeHandler = this.onWindowResize.bind(this);
  }

  createCanvas(width, height) {
    let container = this.container.current;
    let child = container.lastElementChild;
    while (child) {
      container.removeChild(child);
      child = container.lastElementChild;
    }
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
    this.canvas.style.display = 'none';
    this.canvas.className = 'jsbattle_battlefield';
    container.appendChild(this.canvas);

    this.onWindowResizeHandler();
  }

  componentDidMount() {
    this.createCanvas(this.props.width, this.props.height);
    this.renderer = JsBattle.createRenderer(this.props.renderer);
    this.renderer.loadAssets(() => this.onAssetsLoaded());
    window.addEventListener('resize', this.onWindowResizeHandler);
    if(this.props.onInit) {
      this.props.onInit();
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onWindowResizeHandler);
  }

  componentDidUpdate(prevProps) {
    if(!this.simulation) {
      return;
    }
    let hasChanged = (name) => {
      return (prevProps[name] !== this.props[name]);
    };
    if(hasChanged('speed')) {
      this.simulation.setSpeed(this.props.speed);
    }
    if(hasChanged('quality')) {
      this.simulation.setRendererQuality(this.props.quality);
    }
    if(
      hasChanged('aiDefList') ||
      hasChanged('renderer') ||
      hasChanged('rngSeed') ||
      hasChanged('teamMode') ||
      hasChanged('battlefieldWidth') ||
      hasChanged('battlefieldHeight') ||
      hasChanged('modifier') ||
      hasChanged('timeLimit')
    ) {
      this.restart();
    }
  }

  /**
   * Stops battle simulation. It also stops rendering loop.
   * After stop, you cannot resume the battle. Use restart instead.
   * @returns {undefined}
   */
  stop() {
    this.simulation.stop();
  }

  /**
   * Restarts battle simulation.
   * @returns {undefined}
   */
  restart() {
    if(this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    if(this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.createCanvas(this.props.width, this.props.height);
    this.renderer = JsBattle.createRenderer(this.props.renderer);
    this.renderer.loadAssets(() => this.onAssetsLoaded());
    if(this.props.onInit) {
      this.props.onInit();
    }
  }

  onWindowResize() {
    if(!this.props.autoResize) {
      return;
    }
    let w = this.canvas.parentElement.clientWidth;
    let ratio = w/900;
    this.canvas.style.width = (ratio * 900) + "px";
    this.canvas.style.height = (ratio * 600) + "px";

  }

  onAssetsLoaded() {
    this.renderer.init(this.canvas);
    this.simulation = JsBattle.createSimulation(this.renderer);
    let rngSeed;
    if(this.props.rngSeed === undefined) {
      rngSeed = Math.random();
    } else {
      rngSeed = this.props.rngSeed;
    }
    this.simulation.setRngSeed(rngSeed);
    this.simulation.timeLimit = this.props.timeLimit;

    if(this.props.onError) {
      this.simulation.onError((msg) => this.props.onError(msg));
    }
    if(this.props.onStart) {
      this.simulation.onStart(() => this.props.onStart());
    }
    this.simulation.init(this.props.battlefieldWidth, this.props.battlefieldHeight);

    if(this.props.onRender) {
      this.simulation.onRender(() => this.props.onRender(this.simulation));
    }
    this.simulation.setSpeed(this.props.speed !== undefined ? this.props.speed : 1);
    this.simulation.setRendererQuality(this.props.quality !== undefined ? this.props.quality : 'auto');
    this.simulation.onFinish(() => this.handleFinish());

    if(this.props.onReady) {
      this.props.onReady(this.simulation);
    }
    this.canvas.style.display = 'block';

    if(!this.props.aiDefList) {
      throw new Error("aiDefList property was not defined");
    }

    this.props.aiDefList.forEach((ai) => {
      if(this.props.teamMode) {
        ai.assignToTeam(ai.name);
      }
      this.addTank(ai);
    });

    if(this.props.modifier) {
      this.props.modifier(this.simulation);
    }

    this.simulation.start();
  }

  /**
   * Create a tank according to provided `AiDefinition` and adds it to the battle
   * @param {AiDefinition} aiDefinition - defintion of tank AI script
   * @returns {undefined}
   */
  addTank(aiDefinition) {
    try {
      this.simulation.addTank(aiDefinition);
    } catch(err) {
      if(this.props.onError) {
        this.props.onError("Cannot add tank '" + aiDefinition.name + "': " +  (err.message ? err.message : err));
      }
      console.error(err);
    }
  }

  handleFinish() {
    let tankWinner = null;
    let i;
    for(i in this.simulation.tankList) {
      let tank = this.simulation.tankList[i];
      if(!tankWinner || tank.score > tankWinner.score) {
        tankWinner = tank;
      }
    }
    let teamWinner = null;
    for(i in this.simulation.teamList) {
      let team = this.simulation.teamList[i];
      if(!teamWinner || team.score > teamWinner.score) {
        teamWinner = team;
      }
    }
    let result = {
      tankWinner: tankWinner,
      teamWinner: teamWinner,
      tankList: this.simulation.tankList,
      teamList: this.simulation.teamList,
      timeLeft: this.simulation.timeLimit - this.simulation.timeElapsed,
      ubd: this.simulation.createUltimateBattleDescriptor().encode()
    };

    let keepRendering = setInterval(() => {
      this.renderer.preRender();
      this.renderer.postRender();
    }, 30);
    setTimeout(() => {
      clearInterval(keepRendering);
      if(this.props.onFinish) {
        this.props.onFinish(result);
      }
    }, 500);
  }

  /**
   * @return {Array} all tanks that were added to the battle
   */
  get tankList() {
    return this.simulation.tankList;
  }

  /**
   * @return {Array} list of teams
   */
  get teamList() {
    return this.simulation.teamList;
  }

  /**
   * @return {Number} actual quality of renderer. If the quality was set as a number, that number will be returned. If the quality is set as 'auto', current numeric value of quality will be returned
   */
  get actualRendererQuality() {
    return this.renderer.quality;
  }

  /**
   * @return {Simulation} JsBattle simulation object
   */
  getSimulation() {
    return this.simulation;
  }

  render() {
    return <div ref={this.container}></div>;
  }
}

JsBattleBattlefield.defaultProps = {
  width: 900,
  height: 600,
  battlefieldWidth: 900,
  battlefieldHeight: 600,
  renderer: "debug",
  rngSeed: undefined,
  timeLimit: 30000,
  speed: 1,
  quality: 'auto',
  teamMode: false,
  aiDefList: [],
  autoResize: false,
  modifier: undefined,
  onError: undefined,
  onStart: undefined,
  onRender: undefined,
  onReady: undefined,
  onInit: undefined,
  onFinish: undefined,
};

JsBattleBattlefield.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  battlefieldWidth: PropTypes.number,
  battlefieldHeight: PropTypes.number,
  renderer: PropTypes.string,
  rngSeed: PropTypes.number,
  timeLimit: PropTypes.number,
  speed: PropTypes.number,
  quality: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.oneOf(['auto'])
  ]),
  teamMode: PropTypes.oneOf([true, false]),
  autoResize: PropTypes.oneOf([true, false]),
  aiDefList: PropTypes.arrayOf(PropTypes.instanceOf(JsBattle.createAiDefinition().constructor)).isRequired,
  modifier: PropTypes.func,
  onError: PropTypes.func,
  onStart: PropTypes.func,
  onRender: PropTypes.func,
  onReady: PropTypes.func,
  onInit: PropTypes.func,
  onFinish: PropTypes.func,
};

export default JsBattleBattlefield;
