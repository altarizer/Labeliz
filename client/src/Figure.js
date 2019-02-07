import React, { Component, Fragment } from 'react';
import { Polyline, Polygon, CircleMarker } from 'react-leaflet';

class Figure extends Component {
  constructor(props) {
    super(props);
    this.state = {
      dragging: false,
      draggedPoint: null,
    };
  }
  // abstract
  calculateGuides() {
    return [];
  }

  // abstract
  onPointClick(i) {}

  // abstract
  onPointMoved(point, i) {}

  // abstract
  makeExtraElements() {
    return null;
  }

  // abstract
  leafletComponent() {
    return Polygon;
  }

  // abstract
  getRenderPoints(points) {
    return points;
  }

  makeGuides() {
    const guides = this.calculateGuides();
    const { color } = this.props.figure;
    return guides.map((pos, i) => (
      <Polyline
        key={i}
        positions={pos}
        color={color}
        opacity={0.7}
        dashArray="4"
      />
    ));
  }

  render() {
    const { figure, options, skipNextClick } = this.props;
    const { id, points, color } = figure;
    const { editing, finished, interactive, onSelect } = options;

    const renderPoints = this.getRenderPoints(points);

    const vertices = renderPoints.map((pos, i) => (
      <CircleMarker
        key={id + '-' + i}
        color={color}
        center={pos}
        radius={5}
        onClick={() => this.onPointClick(i)}
        draggable={editing}
        onDrag={e => {
          this.setState({
            draggedPoint: { point: e.target.getLatLng(), index: i },
          });
        }}
        onDragstart={e => this.setState({ dragging: true })}
        onDragend={e => {
          this.onPointMoved(e.target.getLatLng(), i);
          this.setState({ dragging: false, draggedPoint: null });
        }}
      />
    ));

    const guideLines = this.makeGuides();
    const PolyComp = this.leafletComponent();

    return (
      <Fragment key={id}>
        <PolyComp
          positions={renderPoints}
          color={color}
          weight={3}
          fill={true}
          fillColor={color}
          interactive={interactive}
          onClick={() => {
            if (interactive) {
              onSelect();
              skipNextClick();
            }
          }}
        />
        {!finished || editing ? vertices : null}
        {guideLines}
        {this.makeExtraElements()}
      </Fragment>
    );
  }
}

export class PolygonFigure extends Figure {
  constructor(props) {
    super(props);

    this.onPointClick = this.onPointClick.bind(this);
  }

  leafletComponent() {
    const {
      options: { finished },
    } = this.props;
    return finished ? Polygon : Polyline;
  }

  calculateGuides() {
    const { figure, options } = this.props;
    const { points } = figure;
    const { newPoint, finished } = options;
    const { draggedPoint } = this.state;

    const guides = [];
    if (draggedPoint) {
      const { point, index } = draggedPoint;
      const { length } = points;
      guides.push(
        [point, points[(index + 1) % length]],
        [point, points[(index - 1 + length) % length]]
      );
    }

    const additionalGuides =
      !finished && points.length > 0
        ? [[points[points.length - 1], newPoint]]
        : [];

    return guides.concat(additionalGuides);
  }

  makeExtraElements() {
    const { figure, options, skipNextClick } = this.props;
    const { id, points } = figure;
    const { editing, finished, calcDistance, onChange } = options;

    const { dragging } = this.state;

    if (!finished || !editing || dragging) {
      return [];
    }

    const midPoints = points
      .map((pos, i) => [pos, points[(i + 1) % points.length], i])
      .filter(([a, b]) => calcDistance(a, b) > 40)
      .map(([a, b, i]) => (
        <CircleMarker
          key={id + '-' + i + '-mid'}
          color="white"
          center={midPoint(a, b)}
          radius={3}
          opacity={0.5}
          onClick={e => {
            onChange('add', { point: midPoint(a, b), pos: i + 1, figure });
            skipNextClick();
          }}
        />
      ));

    return midPoints;
  }

  onPointMoved(point, index) {
    const {
      figure,
      options: { onChange },
    } = this.props;
    onChange('move', { point, pos: index, figure });
  }

  onPointClick(i) {
    const { figure, options, skipNextClick } = this.props;
    const { points } = figure;
    const { finished, editing, onChange } = options;

    if (!finished && i === 0) {
      if (points.length >= 3) {
        onChange('end', {});
      }
      skipNextClick();
      return false;
    }

    if (finished && editing) {
      if (points.length > 3) {
        onChange('remove', { pos: i, figure });
      }
      return false;
    }
  }
}

export class BBoxFigure extends Figure {
  calculateGuides() {
    const { figure, options } = this.props;
    const { points } = figure;
    const { newPoint, finished } = options;
    const { draggedPoint } = this.state;

    if (draggedPoint) {
      const renderPoints = this.getRenderPoints(points);
      const { point, index } = draggedPoint;
      const oppPoint = renderPoints[(index + 2) % renderPoints.length];
      const sidePoint1 = { lat: oppPoint.lat, lng: point.lng };
      const sidePoint2 = { lat: point.lat, lng: oppPoint.lng };
      return [
        [point, sidePoint1],
        [sidePoint1, oppPoint],
        [point, sidePoint2],
        [sidePoint2, oppPoint],
      ];
    }

    if (!finished && points.length > 0) {
      const renderPoints = this.getRenderPoints([points[0], newPoint]);
      return [
        [renderPoints[0], renderPoints[1]],
        [renderPoints[1], renderPoints[2]],
        [renderPoints[2], renderPoints[3]],
        [renderPoints[3], renderPoints[0]],
      ];
    }

    return [];
  }

  getRenderPoints(points) {
    const [p1, p2] = points;
    if (!p1) {
      return [];
    }
    if (!p2) {
      return [p1];
    }

    return [
      { lat: p1.lat, lng: p1.lng },
      { lat: p1.lat, lng: p2.lng },
      { lat: p2.lat, lng: p2.lng },
      { lat: p2.lat, lng: p1.lng },
    ];
  }

  onPointMoved(point, index) {
    const {
      figure,
      options: { onChange },
    } = this.props;
    if (index === 0 || index === 2) {
      onChange('move', { point, pos: index / 2, figure });
    } else {
      const [p1, p2] = figure.points;

      const points =
        index === 1
          ? [{ lat: point.lat, lng: p1.lng }, { lat: p2.lat, lng: point.lng }]
          : [{ lat: p1.lat, lng: point.lng }, { lat: point.lat, lng: p2.lng }];

      onChange('replace', { points, figure });
    }
  }
}

function midPoint(p1, p2) {
  return {
    lat: (p1.lat + p2.lat) / 2,
    lng: (p1.lng + p2.lng) / 2,
  };
}